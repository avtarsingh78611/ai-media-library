"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getUserSession } from "@/lib/auth";
import {
  ArrowLeft,
  Sparkles,
  Play,
  Copy,
  Check,
  Loader2,
  Image as ImageIcon,
  Video as VideoIcon,
  FileText,
  ChevronRight,
  FolderOpen,
} from "lucide-react";
import { dbService, Folder, Asset } from "@/lib/db";

export default function UgcVideoPage() {
  const router = useRouter();

  // Inputs
  const [brief, setBrief] = useState(
    "Create a 30-second UGC video for Solara Naturals Vitamin C Brightening Serum. Generate 3 product reference images first, then create Sophie: a warm, trustworthy 24-year-old skincare creator. Use those references to produce a vertical TikTok-style reel with a hook, product reveal, application, glow reaction, CTA, voiceover, captions, and a separate script file."
  );
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [authChecking, setAuthChecking] = useState(true);
  const [foldersLoading, setFoldersLoading] = useState(true);

  // States
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState(0); // 0: Idle, 1: Script, 2: Images, 3: Video, 4: Storage
  const [copied, setCopied] = useState(false);

  // Outputs
  const [generatedScript, setGeneratedScript] = useState("");
  const [generatedAssets, setGeneratedAssets] = useState<Asset[]>([]);
  const [savedFolderId, setSavedFolderId] = useState("");

  // Focus controller for in-place edit
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    async function ensureAuthAndLoad() {
      try {
        const session = await getUserSession();
        if (!session) {
          router.replace("/login?redirectTo=/custom-more/ugc-video");
          return;
        }
        await loadFolders();
        setAuthChecking(false);
      } catch {
        router.replace("/login?redirectTo=/custom-more/ugc-video");
      }
    }

    ensureAuthAndLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadFolders() {
    try {
      setFoldersLoading(true);
      const data = await dbService.getFolders();
      setFolders(data);
      if (data.length > 0) {
        // Try to default to "Solara Naturals" folder
        const solara = data.find((f) => f.slug.includes("solara"));
        setSelectedFolderId(solara ? solara.id : data[0].id);
      }
    } catch (err) {
      console.error("Error loading folders:", err);
    } finally {
      setFoldersLoading(false);
    }
  }

  if (authChecking) {
    return (
      <div className="min-h-full p-8 flex flex-col gap-8 max-w-7xl mx-auto">
        <div className="flex items-center gap-3" aria-hidden="true">
          <div className="skeleton h-10 w-10 rounded-xl" />
          <div className="space-y-3">
            <div className="skeleton h-8 w-72 rounded" />
            <div className="skeleton h-4 w-96 max-w-full rounded" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="skeleton h-[560px] rounded-2xl border border-neutral-800 lg:col-span-5" />
          <div className="skeleton h-[560px] rounded-2xl border border-neutral-800 lg:col-span-7" />
        </div>
      </div>
    );
  }

  // UGC Pipeline
  const handlePipelineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brief.trim() || isGenerating) return;

    // Validate folder choice
    let folderId = selectedFolderId;
    if (!folderId) {
      // Auto create a folder if none exist
      try {
        const newF = await dbService.createFolder("Solara Naturals");
        folderId = newF.id;
      } catch {
        alert("Please create a workspace folder first!");
        return;
      }
    }

    try {
      setIsGenerating(true);
      setGeneratedScript("");
      setGeneratedAssets([]);
      setSavedFolderId(folderId);

      // Step 1: Script Creation
      setCurrentStep(1);
      const scriptRes = await fetch("/api/openrouter/ugc-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: brief.trim() }),
      });
      if (!scriptRes.ok) throw new Error("Failed script generation");
      const scriptData = await scriptRes.json();
      const scriptText = scriptData.script;
      setGeneratedScript(scriptText);

      // Step 2: Reference Image Generation (3 images)
      setCurrentStep(2);
      const imgPrompts = [
        "Skincare bottle of Solara Naturals Vitamin C Serum on polished light surface.",
        "Golden Vitamin C serum drops textured on glass backdrop.",
        "Sophie: warm 24-year-old skincare creator with glowing skin portrait.",
      ];
      
      const imageUrls: string[] = [];
      const imagePromptDetails: string[] = [];

      for (let i = 0; i < 3; i++) {
        const imgRes = await fetch("/api/generate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: imgPrompts[i], index: i }),
        });
        if (!imgRes.ok) throw new Error(`Failed image generation ${i + 1}`);
        const imgData = await imgRes.json();
        imageUrls.push(imgData.url);
        imagePromptDetails.push(imgData.prompt);
      }

      // Step 3: Video Generation
      setCurrentStep(3);
      const vidRes = await fetch("/api/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "Sophie applying Solara Naturals Vitamin C Serum, dewy glass skin outcome." }),
      });
      if (!vidRes.ok) throw new Error("Failed video generation");
      const vidData = await vidRes.json();
      const videoUrl = vidData.url;
      const videoPromptUsed = vidData.prompt;

      // Step 4: Storage Upload and Saving to DB
      setCurrentStep(4);
      const currentFolder = folders.find((f) => f.id === folderId) || { slug: "ugc-campaign" };
      const folderSlug = currentFolder.slug;

      const savedList: Asset[] = [];

      // 4.1 Save script as txt file
      const scriptBlob = new Blob([scriptText], { type: "text/plain" });
      const scriptUrl = await dbService.uploadFile(scriptBlob, folderSlug, "script.txt");
      const scriptAsset = await dbService.createAsset(
        folderId,
        "text",
        scriptUrl,
        brief.trim(),
        { fileName: "script.txt", scriptText }
      );
      savedList.push(scriptAsset);

      // 4.2 Save generated images
      for (let i = 0; i < imageUrls.length; i++) {
        const imgUrl = imageUrls[i];
        let fileBlob: Blob;
        
        if (imgUrl.startsWith("data:")) {
          // Convert data URI to Blob
          const res = await fetch(imgUrl);
          fileBlob = await res.blob();
        } else {
          // In mock mode, if url is external, we fetch it
          try {
            const res = await fetch(imgUrl);
            fileBlob = await res.blob();
          } catch {
            // fallback blob if cors blocks
            fileBlob = new Blob(["mock-img"], { type: "image/jpeg" });
          }
        }

        const uploadedUrl = await dbService.uploadFile(fileBlob, folderSlug, `ref_image_${i + 1}.jpg`);
        const imgAsset = await dbService.createAsset(
          folderId,
          "image",
          uploadedUrl,
          imagePromptDetails[i],
          { fileName: `ref_image_${i + 1}.jpg` }
        );
        savedList.push(imgAsset);
      }

      // 4.3 Save video
      let vidBlob: Blob;
      if (videoUrl.startsWith("data:")) {
        const res = await fetch(videoUrl);
        vidBlob = await res.blob();
      } else {
        try {
          const res = await fetch(videoUrl);
          vidBlob = await res.blob();
        } catch {
          vidBlob = new Blob(["mock-vid"], { type: "video/mp4" });
        }
      }
      const uploadedVidUrl = await dbService.uploadFile(vidBlob, folderSlug, "creator_reel.mp4");
      const vidAsset = await dbService.createAsset(
        folderId,
        "video",
        uploadedVidUrl,
        videoPromptUsed,
        { fileName: "creator_reel.mp4", duration: 15 }
      );
      savedList.push(vidAsset);

      setGeneratedAssets(savedList);
      setCurrentStep(5); // Success complete
    } catch (err) {
      console.error("Pipeline failure:", err);
      alert("AI pipeline encountered an error. Check server key configuration.");
      setCurrentStep(0);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyScript = () => {
    if (!generatedScript) return;
    navigator.clipboard.writeText(generatedScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-full p-8 flex flex-col gap-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <Link
          href="/custom-more"
          className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Custom More
        </Link>
        <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
          <Sparkles className="w-7 h-7 text-accent" />
          UGC Creator Video Pipeline
        </h1>
        <p className="text-neutral-400 text-sm">
          Formulate campaign creative briefs into script templates and media assets instantly.
        </p>
      </div>

      {/* Main Split Editor / Gallery Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* Left Side: Brief Editor & Controls (5 Columns) */}
        <div className="lg:col-span-5 bg-neutral-900 border border-neutral-800 rounded-2xl p-6 flex flex-col gap-5 shadow-xl">
          <div className="border-b border-neutral-800 pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              Creative Brief
            </h3>
          </div>

          <form onSubmit={handlePipelineSubmit} className="flex-1 flex flex-col gap-5">
            {/* Folder Destination Selector */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                Target Folder Destination
              </label>
              {foldersLoading ? (
                <div className="skeleton h-12 w-full rounded-xl border border-neutral-800" aria-hidden="true" />
              ) : (
                <select
                  value={selectedFolderId}
                  onChange={(e) => setSelectedFolderId(e.target.value)}
                  disabled={isGenerating}
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-accent rounded-xl px-4 py-3 text-white text-sm focus:outline-none transition-colors"
                >
                  {folders.length === 0 ? (
                    <option value="">Default (Creates &apos;Solara Naturals&apos;)</option>
                  ) : (
                    folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} (/{f.slug})
                      </option>
                    ))
                  )}
                </select>
              )}
            </div>

            {/* In-place Editable Area */}
            <div className="flex-1 flex flex-col">
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                Campaign Brief Instructions
              </label>
              <textarea
                ref={textareaRef}
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                disabled={isGenerating}
                className="flex-1 w-full bg-neutral-950 border border-neutral-800 focus:border-accent rounded-xl p-4 text-white text-sm focus:outline-none transition-colors resize-none placeholder-neutral-600 leading-relaxed font-sans cursor-text"
              />
            </div>

            {/* Pipeline Progress Indicator */}
            {isGenerating && (
              <div className="space-y-2 bg-neutral-950/50 p-4 border border-neutral-850 rounded-xl text-xs">
                <div className="flex justify-between font-semibold text-neutral-300">
                  <span>Generation Progress</span>
                  <span>{currentStep * 25}%</span>
                </div>
                <div className="w-full bg-neutral-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-accent h-full transition-all duration-350"
                    style={{ width: `${currentStep * 25}%` }}
                  />
                </div>
                <ul className="space-y-1.5 text-neutral-500 mt-2">
                  <li className={`flex items-center gap-2 ${currentStep >= 1 ? "text-accent" : ""}`}>
                    {currentStep > 1 ? <Check className="w-3.5 h-3.5" /> : currentStep === 1 ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "•"}
                    <span>1. Drafting structured script</span>
                  </li>
                  <li className={`flex items-center gap-2 ${currentStep >= 2 ? "text-accent" : ""}`}>
                    {currentStep > 2 ? <Check className="w-3.5 h-3.5" /> : currentStep === 2 ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "•"}
                    <span>2. Synthesizing reference images</span>
                  </li>
                  <li className={`flex items-center gap-2 ${currentStep >= 3 ? "text-accent" : ""}`}>
                    {currentStep > 3 ? <Check className="w-3.5 h-3.5" /> : currentStep === 3 ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "•"}
                    <span>3. Compiling creative video clips</span>
                  </li>
                  <li className={`flex items-center gap-2 ${currentStep >= 4 ? "text-accent" : ""}`}>
                    {currentStep > 4 ? <Check className="w-3.5 h-3.5" /> : currentStep === 4 ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "•"}
                    <span>4. Archiving files to Supabase</span>
                  </li>
                </ul>
              </div>
            )}

            {/* Action Submit */}
            <button
              type="submit"
              disabled={isGenerating || !brief.trim()}
              className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-neutral-950 font-extrabold py-3.5 rounded-xl transition-all duration-200 shadow-lg shadow-accent/5 active:scale-95 text-base"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Processing UGC Pipeline...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>Submit Campaign Brief</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Side: Assets Gallery & Script.txt Viewer (7 Columns) */}
        <div className="lg:col-span-7 bg-neutral-900 border border-neutral-800 rounded-2xl p-6 flex flex-col gap-6 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              Generated Outputs
            </h3>
            {currentStep === 5 && (
              <Link
                href={`/my-work/${savedFolderId}`}
                className="text-xs text-accent hover:underline flex items-center gap-1 font-semibold"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Open Folder Library</span>
                <ChevronRight className="w-3 h-3" />
              </Link>
            )}
          </div>

          {currentStep === 0 && !generatedScript && (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-20">
              <FileText className="w-16 h-16 text-neutral-800 mb-4" />
              <h4 className="text-base font-bold text-neutral-400">Pipeline output ready</h4>
              <p className="text-neutral-500 text-xs mt-1 max-w-xs leading-relaxed">
                Click Submit to launch the OpenRouter script generator, synthesize reference assets, and compile files in Supabase storage.
              </p>
            </div>
          )}

          {(currentStep > 0 || generatedScript) && (
            <div className="flex-1 flex flex-col gap-6 overflow-y-auto">
              {/* Asset grid: images/video thumbnails */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-3 flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4" />
                  Media Gallery
                </h4>

                {generatedAssets.length === 0 ? (
                  <div className="grid grid-cols-4 gap-3">
                    <div className="aspect-square bg-neutral-950/60 rounded-xl border border-neutral-850 flex items-center justify-center animate-pulse">
                      <ImageIcon className="w-6 h-6 text-neutral-700" />
                    </div>
                    <div className="aspect-square bg-neutral-950/60 rounded-xl border border-neutral-850 flex items-center justify-center animate-pulse">
                      <ImageIcon className="w-6 h-6 text-neutral-700" />
                    </div>
                    <div className="aspect-square bg-neutral-950/60 rounded-xl border border-neutral-850 flex items-center justify-center animate-pulse">
                      <ImageIcon className="w-6 h-6 text-neutral-700" />
                    </div>
                    <div className="aspect-square bg-neutral-950/60 rounded-xl border border-neutral-850 flex items-center justify-center animate-pulse">
                      <VideoIcon className="w-6 h-6 text-neutral-700" />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-3">
                    {generatedAssets
                      .filter((asset) => asset.type !== "text")
                      .map((asset) => {
                        const isVideo = asset.type === "video";
                        return (
                          <div
                            key={asset.id}
                            className="group relative aspect-square bg-neutral-950 border border-neutral-850 rounded-xl overflow-hidden hover:border-neutral-750 transition-all cursor-pointer"
                            onClick={() => router.push(`/my-work/${asset.folder_id}`)}
                          >
                            {isVideo ? (
                              <div className="w-full h-full relative">
                                <video
                                  src={asset.storage_path}
                                  className="w-full h-full object-cover"
                                  muted
                                />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                                  <Play className="w-5 h-5 text-accent fill-current" />
                                </div>
                              </div>
                            ) : (
                              <img
                                src={asset.storage_path}
                                alt="generated reference"
                                className="w-full h-full object-cover"
                              />
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* Inline script rendering */}
              <div className="flex-1 flex flex-col min-h-[300px]">
                <div className="flex items-center justify-between mb-3 shrink-0">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
                    <FileText className="w-4 h-4" />
                    Generated Script File (script.txt)
                  </h4>
                  {generatedScript && (
                    <button
                      onClick={handleCopyScript}
                      className="text-xs text-accent hover:underline flex items-center gap-1 font-semibold"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-accent" />
                          <span>Copied Script</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Script</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                <div className="flex-1 bg-neutral-950 border border-neutral-850 rounded-xl p-5 overflow-y-auto relative">
                  {generatedScript ? (
                    <pre className="text-xs text-neutral-300 font-mono leading-relaxed whitespace-pre-wrap select-text">
                      {generatedScript}
                    </pre>
                  ) : (
                    <div className="flex items-center justify-center h-full animate-pulse text-neutral-600 text-xs">
                      <Loader2 className="w-4 h-4 animate-spin text-accent mr-2" />
                      Drafting script file...
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
