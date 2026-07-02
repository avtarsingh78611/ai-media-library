"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { getUserSession } from "@/lib/auth";
import {
  ArrowLeft,
  Upload,
  Play,
  X,
  Copy,
  Eye,
  Download,
  Sparkles,
  Loader2,
  Image as ImageIcon,
  Video as VideoIcon,
  Check,
} from "lucide-react";
import { dbService, Folder, Asset, getErrorMessage, getAssetUrl } from "@/lib/db";

export default function FolderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const folderId = params.folderId as string;

  const [folder, setFolder] = useState<Folder | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [authChecking, setAuthChecking] = useState(true);
  const [loading, setLoading] = useState(true);

  // Interaction States
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Upload States
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadPrompt, setUploadPrompt] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadError, setUploadError] = useState("");
  // Preview states for drawer/lightbox
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");

  useEffect(() => {
    async function ensureAuthAndLoad() {
      try {
        const session = await getUserSession();
        if (!session) {
          router.replace(`/login?redirectTo=/my-work/${folderId}`);
          return;
        }

        if (folderId) {
          await loadFolderData();
        }
        setAuthChecking(false);
      } catch {
        router.replace(`/login?redirectTo=/my-work/${folderId}`);
      }
    }

    ensureAuthAndLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folderId]);

  async function loadFolderData() {
    try {
      setLoading(true);
      const folders = await dbService.getFolders();
      const currentFolder = folders.find((f) => f.id === folderId);
      if (!currentFolder) {
        router.push("/my-work");
        return;
      }
      setFolder(currentFolder);

      const folderAssets = await dbService.getAssets(folderId);
      setAssets(folderAssets);
    } catch (err) {
      console.error("Error loading folder detail:", err);
    } finally {
      setLoading(false);
    }
  }

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadError("");
      setPendingFile(file);
      setUploadPrompt("");
      setIsUploadDialogOpen(true);
    }
  };

  // Perform upload
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingFile || !folder) return;

    try {
      setUploading(true);
      setUploadError("");
      setIsUploadDialogOpen(false);

      const type = pendingFile.type.startsWith("video/") ? "video" : "image";
      const publicUrl = await dbService.uploadFile(
        pendingFile,
        folder.slug,
        pendingFile.name
      );

      // Create db record
      const metadata = {
        size: pendingFile.size,
        fileName: pendingFile.name,
      };

      await dbService.createAsset(
        folder.id,
        type,
        publicUrl,
        uploadPrompt.trim() || "Uploaded brand asset.",
        metadata
      );

      setPendingFile(null);
      setUploadPrompt("");
      await loadFolderData();
    } catch (err) {
      const message = getErrorMessage(err);
      console.error("Upload error:", message, err);
      setUploadError(message);
    } finally {
      setUploading(false);
    }
  };

  // Trigger copy prompt
  const handleCopyPrompt = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Asset preview helper (fetches signed URL)
  function AssetPreview({ asset }: { asset: Asset }) {
    const [url, setUrl] = useState<string | null>(null);
    const [loading, setLoadingState] = useState(true);
    const [err, setErr] = useState("");

    useEffect(() => {
      let mounted = true;
      setLoadingState(true);
      setErr("");
      getAssetUrl(asset.storage_path)
        .then((u) => {
          if (!mounted) return;
          setUrl(u);
        })
        .catch((e) => {
          if (!mounted) return;
          setErr(String(e));
        })
        .finally(() => {
          if (!mounted) return;
          setLoadingState(false);
        });
      return () => {
        mounted = false;
      };
    }, [asset.storage_path]);

    if (loading) {
      return (
        <div className="skeleton h-full w-full" />
      );
    }

    if (err || !url) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-neutral-900 text-neutral-500 text-xs">
          Preview unavailable
        </div>
      );
    }

    if (asset.type === "video") {
      return (
        <video
          src={url}
          muted
          playsInline
          className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
        />
      );
    }

    return <img src={url} alt={asset.prompt} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />;
  }

  // When selectedAsset changes, resolve its signed URL for drawer/lightbox preview
  useEffect(() => {
    let mounted = true;
    if (!selectedAsset) {
      setPreviewUrl(null);
      setPreviewError("");
      setPreviewLoading(false);
      return;
    }

    setPreviewLoading(true);
    setPreviewError("");
    getAssetUrl(selectedAsset.storage_path)
      .then((u) => {
        if (!mounted) return;
        setPreviewUrl(u);
      })
      .catch((e) => {
        if (!mounted) return;
        setPreviewError(String(e));
      })
      .finally(() => {
        if (!mounted) return;
        setPreviewLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [selectedAsset]);

  // File download helper
  const handleDownload = async (url: string, filename: string) => {
    try {
      if (url.startsWith("data:")) {
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }

      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Download failed:", error);
      // Fallback
      window.open(url, "_blank");
    }
  };

  const handleRecreate = (promptText: string) => {
    setIsPromptModalOpen(false);
    setIsDrawerOpen(false);
    // Prefill prompt generator by setting query param
    router.push(`/prompt-generator?prefill=${encodeURIComponent(promptText)}`);
  };

  function AssetGridSkeleton() {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4" aria-hidden="true">
        {Array.from({ length: 12 }).map((_, index) => (
          <div key={index} className="aspect-square overflow-hidden rounded-xl border border-neutral-850 bg-neutral-900">
            <div className="skeleton h-full w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (authChecking) {
    return (
      <div className="min-h-full p-8 flex flex-col gap-6 max-w-7xl mx-auto">
        <div className="flex flex-col gap-4" aria-hidden="true">
          <div className="skeleton h-5 w-40 rounded" />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-3">
              <div className="skeleton h-9 w-56 rounded" />
              <div className="skeleton h-4 w-36 rounded" />
            </div>
            <div className="skeleton h-12 w-36 rounded-xl" />
          </div>
        </div>
        <AssetGridSkeleton />
      </div>
    );
  }

  return (
    <div className="min-h-full p-8 flex flex-col gap-6 max-w-7xl mx-auto relative overflow-x-hidden">
      {/* Breadcrumb Header */}
      <div className="flex flex-col gap-4">
        <Link
          href="/my-work"
          className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Workspaces
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              {folder?.name || "Loading folder..."}
            </h1>
            <p className="text-neutral-400 text-sm mt-1">
              /{folder?.slug} • {assets.length} {assets.length === 1 ? "asset" : "assets"}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*,video/*"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-neutral-950 px-5 py-3 rounded-xl font-semibold shadow-lg shadow-accent/10 transition-all duration-200 transform active:scale-95 disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Upload className="w-5 h-5" />
              )}
              <span>{uploading ? "Uploading..." : "Upload Asset"}</span>
            </button>
          </div>
        </div>
      </div>

      {uploadError && (
        <div className="rounded-2xl border border-red-700 bg-red-950/70 px-4 py-3 text-sm text-red-200 mb-4">
          <strong className="font-semibold">Upload Error:</strong> {uploadError}
        </div>
      )}

      {/* Assets Grid */}
      {loading ? (
        <AssetGridSkeleton />
      ) : assets.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-24 border border-dashed border-neutral-800 rounded-2xl bg-neutral-900/20 text-center px-4">
          <ImageIcon className="w-12 h-12 text-neutral-600 mb-4" />
          <h3 className="text-lg font-bold text-neutral-200">Workspace empty</h3>
          <p className="text-neutral-500 text-sm mt-1 max-w-xs mx-auto">
            Drag and drop images or videos, or click the upload button to fill this workspace folder.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {assets.map((asset) => {
            const isVideo = asset.type === "video";
            return (
              <div
                key={asset.id}
                onClick={() => {
                  setSelectedAsset(asset);
                  setIsDrawerOpen(true);
                }}
                className="group relative aspect-square bg-neutral-900 border border-neutral-850 rounded-xl overflow-hidden cursor-pointer hover:border-neutral-700 transition-all duration-300"
              >
                <div className="w-full h-full relative">
                  <AssetPreview asset={asset} />
                  {isVideo && (
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover:bg-black/10 transition-colors">
                      <div className="w-12 h-12 rounded-full bg-accent/90 text-neutral-950 flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                        <Play className="w-5 h-5 fill-current ml-0.5" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Badge Overlay */}
                <div className="absolute top-2 left-2 z-10">
                  <span className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded bg-black/60 backdrop-blur-md text-white">
                    {isVideo ? (
                      <>
                        <VideoIcon className="w-3 h-3 text-red-400" />
                        Video
                      </>
                    ) : (
                      <>
                        <ImageIcon className="w-3 h-3 text-blue-400" />
                        Image
                      </>
                    )}
                  </span>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* --- SLIDE-IN DETAIL PANEL (DRAWER) --- */}
      <div
        className={`fixed inset-y-0 right-0 w-full sm:w-[850px] bg-neutral-900 border-l border-neutral-800 shadow-2xl z-40 transform transition-transform duration-350 ease-out flex flex-col ${
          isDrawerOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {selectedAsset && (
          <div className="h-full flex flex-col">
            {/* Drawer Header */}
            <div className="h-16 flex items-center justify-between px-6 border-b border-neutral-800 shrink-0">
              <span className="text-sm font-semibold uppercase tracking-wider text-neutral-400">
                Asset Specifications
              </span>
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="p-2 hover:bg-neutral-800 text-neutral-400 hover:text-white rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Split Panel Content */}
            <div className="flex-1 overflow-y-auto flex flex-col md:flex-row min-h-0">
              {/* Left Side: Large Preview */}
              <div className="flex-1 bg-black/60 flex items-center justify-center p-6 border-b md:border-b-0 md:border-r border-neutral-800 relative">
                {previewLoading ? (
                  <div className="flex items-center justify-center">
                    <Loader2 className="w-10 h-10 animate-spin text-accent" />
                  </div>
                ) : previewError ? (
                  <div className="text-sm text-red-400">Preview unavailable: {previewError}</div>
                ) : previewUrl ? (
                  selectedAsset.type === "video" ? (
                    <video
                      src={previewUrl}
                      className="max-h-[500px] md:max-h-full max-w-full rounded-lg shadow-2xl"
                      controls
                      playsInline
                    />
                  ) : (
                    <img
                      src={previewUrl}
                      alt={selectedAsset.prompt}
                      className="max-h-[500px] md:max-h-full max-w-full rounded-lg object-contain shadow-2xl"
                    />
                  )
                ) : (
                  <div className="text-sm text-neutral-500">No preview available</div>
                )}
              </div>

              {/* Right Side: Fields */}
              <div className="w-full md:w-[350px] p-6 flex flex-col gap-6 shrink-0 bg-neutral-900/60 overflow-y-auto">
                {/* File Information */}
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">
                    Type
                  </h4>
                  <div className="flex items-center gap-2 text-white">
                    {selectedAsset.type === "video" ? (
                      <VideoIcon className="w-5 h-5 text-accent" />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-accent" />
                    )}
                    <span className="text-sm font-medium capitalize">
                      {selectedAsset.type} Asset
                    </span>
                  </div>
                </div>

                {/* Prompt Field */}
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">
                    Prompt Used
                  </h4>
                  <button
                    onClick={() => setIsPromptModalOpen(true)}
                    className="w-full text-left bg-neutral-950 hover:bg-neutral-950/60 border border-neutral-800 hover:border-neutral-700 p-4 rounded-xl transition-all group"
                  >
                    <p className="text-sm text-neutral-200 line-clamp-4 leading-relaxed group-hover:text-white transition-colors">
                      {selectedAsset.prompt}
                    </p>
                    <span className="text-xs text-accent mt-3 inline-flex items-center gap-1.5 font-semibold group-hover:underline">
                      <Sparkles className="w-3.5 h-3.5" />
                      View full prompt sheet
                    </span>
                  </button>
                </div>

                {/* Metadata details */}
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">
                    File Details
                  </h4>
                  <div className="bg-neutral-950/40 rounded-xl p-4 border border-neutral-850 text-xs space-y-2 text-neutral-400">
                    <div className="flex justify-between">
                      <span>File Name:</span>
                      <span className="text-neutral-200 truncate max-w-[180px]">
                        {selectedAsset.metadata?.fileName || "asset_" + selectedAsset.id.substring(0, 5)}
                      </span>
                    </div>
                    {selectedAsset.metadata?.width && (
                      <div className="flex justify-between">
                        <span>Dimensions:</span>
                        <span className="text-neutral-200">
                          {selectedAsset.metadata.width} x {selectedAsset.metadata.height} px
                        </span>
                      </div>
                    )}
                    {selectedAsset.metadata?.size && (
                      <div className="flex justify-between">
                        <span>File Size:</span>
                        <span className="text-neutral-200">
                          {(selectedAsset.metadata.size / 1024 / 1024).toFixed(2)} MB
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Row */}
                <div className="mt-auto pt-6 border-t border-neutral-800 flex items-center gap-3">
                  <button
                    onClick={() => setIsLightboxOpen(true)}
                    className="flex-1 flex items-center justify-center gap-2 border border-neutral-800 hover:bg-neutral-800 text-neutral-200 hover:text-white py-3 rounded-xl font-semibold text-sm transition-all"
                  >
                    <Eye className="w-4 h-4" />
                    <span>Fullscreen</span>
                  </button>
                  <button
                    onClick={() =>
                      handleDownload(
                            previewUrl || selectedAsset.storage_path,
                            selectedAsset.metadata?.fileName || `download_${selectedAsset.id}`
                          )
                    }
                    className="flex-1 flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-neutral-950 py-3 rounded-xl font-semibold text-sm transition-all"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Drawer Backdrop */}
      {isDrawerOpen && (
        <div
          onClick={() => setIsDrawerOpen(false)}
          className="fixed inset-0 bg-black/60 z-30 transition-opacity"
        />
      )}

      {/* --- PROMPT MODAL (ON TOP OF EVERYTHING) --- */}
      {isPromptModalOpen && selectedAsset && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-2xl shadow-2xl p-6 relative overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-accent" />
                Prompt Sheet Detail
              </h3>
              <button
                onClick={() => setIsPromptModalOpen(false)}
                className="p-1.5 hover:bg-neutral-800 text-neutral-400 hover:text-white rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Prompt body */}
            <div className="flex-1 overflow-y-auto my-4 py-2">
              <div className="relative bg-neutral-950 border border-neutral-850 rounded-xl p-5">
                <pre className="text-sm text-neutral-200 whitespace-pre-wrap font-mono leading-relaxed select-text">
                  {selectedAsset.prompt}
                </pre>
                <button
                  onClick={() => handleCopyPrompt(selectedAsset.prompt)}
                  className="absolute top-4 right-4 p-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-white rounded-lg transition-all"
                  title="Copy Prompt"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-accent" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Action Row matching reference screenshot layout (Recreate / Video / Download etc) */}
            <div className="pt-4 border-t border-neutral-800 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-neutral-500 font-semibold uppercase tracking-wider">
                Action Suite
              </span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleRecreate(selectedAsset.prompt)}
                  className="flex items-center gap-1.5 border border-neutral-800 hover:bg-neutral-850 text-neutral-300 hover:text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
                >
                  <Sparkles className="w-4 h-4 text-accent" />
                  <span>Recreate</span>
                </button>
                <button
                  onClick={() => {
                    setIsPromptModalOpen(false);
                    setIsLightboxOpen(true);
                  }}
                  className="flex items-center gap-1.5 border border-neutral-800 hover:bg-neutral-850 text-neutral-300 hover:text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
                >
                  <Eye className="w-4 h-4" />
                  <span>Eye (Preview)</span>
                </button>
                <button
                  onClick={() =>
                    handleDownload(
                      previewUrl || selectedAsset.storage_path,
                      selectedAsset.metadata?.fileName || `download_${selectedAsset.id}`
                    )
                  }
                  className="flex items-center gap-1.5 bg-accent hover:bg-accent-hover text-neutral-950 px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md shadow-accent/5"
                >
                  <Download className="w-4 h-4" />
                  <span>Download</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- FULLSCREEN LIGHTBOX --- */}
      {isLightboxOpen && selectedAsset && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center p-4 select-none animate-in fade-in duration-200">
          {/* Lightbox Controls */}
          <div className="absolute top-6 right-6 flex items-center gap-3 z-50">
            <button
                onClick={() =>
                handleDownload(
                  previewUrl || selectedAsset.storage_path,
                  selectedAsset.metadata?.fileName || `download_${selectedAsset.id}`
                )
              }
              className="p-3 bg-neutral-900/60 hover:bg-neutral-900 text-neutral-200 hover:text-white rounded-full transition-all border border-neutral-800"
              title="Download File"
            >
              <Download className="w-5 h-5" />
            </button>
            <button
              onClick={() => setIsLightboxOpen(false)}
              className="p-3 bg-neutral-900/60 hover:bg-neutral-900 text-neutral-200 hover:text-white rounded-full transition-all border border-neutral-800"
              title="Close Fullscreen"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Lightbox Media Container */}
          <div className="w-full h-full flex items-center justify-center">
            {previewLoading ? (
              <Loader2 className="w-12 h-12 animate-spin text-accent" />
            ) : previewError ? (
              <div className="text-sm text-red-400">Preview error: {previewError}</div>
            ) : previewUrl ? (
              selectedAsset.type === "video" ? (
                <video
                  src={previewUrl}
                  className="max-h-[90vh] max-w-[90vw] rounded-lg"
                  controls
                  autoPlay
                  playsInline
                />
              ) : (
                <img
                  src={previewUrl}
                  alt={selectedAsset.prompt}
                  className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
                />
              )
            ) : (
              <div className="text-sm text-neutral-500">No preview available</div>
            )}
          </div>
        </div>
      )}

      {/* Upload progress overlay */}
      {uploading && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-950/95 border border-neutral-800 rounded-3xl shadow-2xl p-8 max-w-xl w-full text-center">
            <Loader2 className="mx-auto mb-6 h-14 w-14 animate-spin text-accent" />
            <h2 className="text-2xl font-bold text-white mb-2">Uploading Asset</h2>
            <p className="text-neutral-400 text-sm max-w-lg mx-auto">
              Your file is being uploaded to Supabase storage. Please keep this window open while we finish saving your asset.
            </p>
          </div>
        </div>
      )}

      {/* --- FILE UPLOAD PROMPT DIALOG --- */}
      {isUploadDialogOpen && pendingFile && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md shadow-2xl p-6 relative">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Upload className="w-5 h-5 text-accent" />
              Configure Upload
            </h3>
            <p className="text-neutral-400 text-xs mt-1">
              Add details about the generated asset you are uploading.
            </p>

            <form onSubmit={handleUploadSubmit} className="mt-5 flex flex-col gap-4">
              <div>
                <span className="block text-xs text-neutral-400 mb-1">File chosen:</span>
                <span className="block text-sm font-semibold text-white bg-neutral-950 px-3 py-2 rounded-lg border border-neutral-850 truncate">
                  {pendingFile.name} ({(pendingFile.size / 1024 / 1024).toFixed(2)} MB)
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                  AI Generation Prompt (Optional)
                </label>
                <textarea
                  rows={4}
                  placeholder="e.g. Ultra high quality product shot..."
                  value={uploadPrompt}
                  onChange={(e) => setUploadPrompt(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-accent rounded-xl px-4 py-3 text-white text-sm focus:outline-none transition-colors resize-none"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-neutral-800/50">
                <button
                  type="button"
                  onClick={() => {
                    setIsUploadDialogOpen(false);
                    setPendingFile(null);
                  }}
                  className="px-4 py-2.5 rounded-xl border border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800/30 text-sm font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-accent hover:bg-accent-hover text-neutral-950 px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors"
                >
                  Start Upload
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
