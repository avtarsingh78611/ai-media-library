"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ChevronDown, Loader2, Folder as FolderIcon, Eye, Download, Sparkles, X } from "lucide-react";
import { dbService, Asset, Folder as FolderType, getAssetUrl } from "@/lib/db";
import { getUserSession } from "@/lib/auth";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

const galleryTileClasses = [
  "md:row-span-2",
  "md:col-span-2",
  "",
  "",
  "",
  "md:row-span-2",
  "md:col-span-2",
  "",
  "md:col-span-2",
  "",
  "",
  "md:row-span-2",
];

function GalleryCard({ asset, layoutClass, onSelect }: { asset: Asset; layoutClass: string; onSelect: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const isVideo = asset.type === "video";

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(false);
    getAssetUrl(asset.storage_path)
      .then((signedUrl) => {
        if (!mounted) return;
        if (signedUrl) {
          setUrl(signedUrl);
        } else {
          console.warn(`[GalleryCard] Empty signed URL returned for ${asset.id}`);
          setError(true);
        }
      })
      .catch((err) => {
        if (!mounted) return;
        console.error("[GalleryCard] Error fetching signed URL:", err);
        setError(true);
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [asset.storage_path, asset.id]);

  return (
    <div
      onClick={onSelect}
      className={`group relative min-h-[160px] cursor-pointer overflow-hidden rounded-lg border border-neutral-900 bg-neutral-950 transition-all duration-200 hover:border-neutral-600 ${layoutClass}`}
    >
      <div className="absolute inset-0 flex items-center justify-center bg-neutral-950">
        {loading ? (
          <div className="skeleton h-full w-full" />
        ) : error ? (
          <div className="text-xs text-red-400 text-center px-2">Preview unavailable</div>
        ) : url ? (
          isVideo ? (
            <video
              src={url}
              muted
              playsInline
              loop
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <img
              src={url}
              alt={asset.prompt}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
          )
        ) : null}
      </div>
    </div>
  );
}

function GallerySkeleton() {
  return (
    <div className="grid auto-rows-[160px] grid-cols-2 gap-1 sm:auto-rows-[180px] lg:grid-cols-4 xl:auto-rows-[205px]" aria-hidden="true">
      {galleryTileClasses.map((layoutClass, index) => (
        <div
          key={index}
          className={`skeleton min-h-[160px] rounded-lg border border-neutral-900 ${layoutClass}`}
        />
      ))}
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [folders, setFolders] = useState<FolderType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "image" | "video">("all");
  const [folderFilter, setFolderFilter] = useState("all");
  const [dateSort, setDateSort] = useState<"newest" | "oldest">("newest");
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    async function loadGallery() {
      setLoading(true);
      try {
        const [folderData, assetData, session] = await Promise.all([
          dbService.getPublicFolders(),
          dbService.getPublicAssets(),
          getUserSession().catch(() => null),
        ]);

        setFolders(folderData);
        setAssets(
          assetData.sort((a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )
        );
        setIsAuthenticated(!!session);
      } catch (error) {
        console.error("Failed to load public gallery:", error);
      } finally {
        setLoading(false);
      }
    }

    loadGallery();
  }, []);

  useEffect(() => {
    if (!selectedAsset) {
      setPreviewUrl(null);
      setPreviewError("");
      setPreviewLoading(false);
      return;
    }

    let mounted = true;
    setPreviewLoading(true);
    setPreviewError("");
    getAssetUrl(selectedAsset.storage_path)
      .then((url) => {
        if (!mounted) return;
        if (url) {
          setPreviewUrl(url);
        } else {
          setPreviewError("Failed to generate preview URL. Check browser console for details.");
        }
      })
      .catch((err) => {
        if (!mounted) return;
        setPreviewError(String(err));
      })
      .finally(() => {
        if (!mounted) return;
        setPreviewLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [selectedAsset]);

  const filteredAssets = useMemo(() => {
    return assets
      .filter((asset) => {
        if (typeFilter !== "all" && asset.type !== typeFilter) {
          return false;
        }

        if (folderFilter !== "all" && asset.folder_id !== folderFilter) {
          return false;
        }

        const normalizedQuery = searchQuery.trim().toLowerCase();
        if (!normalizedQuery) {
          return true;
        }

        const promptMatch = asset.prompt.toLowerCase().includes(normalizedQuery);
        const nameMatch = String(asset.metadata?.fileName || "").toLowerCase().includes(normalizedQuery);
        return promptMatch || nameMatch;
      })
      .sort((a, b) => {
        const aTime = new Date(a.created_at).getTime();
        const bTime = new Date(b.created_at).getTime();
        return dateSort === "newest" ? bTime - aTime : aTime - bTime;
      });
  }, [assets, typeFilter, folderFilter, searchQuery, dateSort]);

  const selectedFolderName = selectedAsset
    ? folders.find((folder) => folder.id === selectedAsset.folder_id)?.name || "Unknown Workspace"
    : "";
  const selectedFileName = selectedAsset
    ? String(selectedAsset.metadata?.fileName || `asset_${selectedAsset.id.slice(0, 6)}`)
    : "";

  const handleRecreate = () => {
    if (!selectedAsset) return;
    if (!isAuthenticated) return;
    router.push(`/prompt-generator?prefill=${encodeURIComponent(selectedAsset.prompt)}`);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedAsset(null);
    setPreviewUrl(null);
    setPreviewError("");
  };

  return (
    <div className="min-h-full p-8 flex flex-col gap-8 max-w-7xl mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Public Asset Gallery</h1>
          <p className="text-neutral-400 text-sm mt-1 max-w-2xl">
            Browse uploaded images and videos across all workspaces. Management controls stay protected behind authentication.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {isAuthenticated ? (
            <button
              type="button"
              onClick={() => router.push("/my-work")}
              className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-neutral-950 px-4 py-3 rounded-xl font-semibold transition-all duration-200"
            >
              <FolderIcon className="w-4 h-4" />
              My Work
            </button>
          ) : (
            <button
              type="button"
              onClick={() => router.push("/login?redirectTo=/my-work")}
              className="inline-flex items-center gap-2 border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 px-4 py-3 rounded-xl font-semibold transition-all duration-200"
            >
              Login to manage
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-2 shadow-sm shadow-black/10">
          <div className="flex h-11 items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-950/70 px-3">
            <Search className="w-4 h-4 text-neutral-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by prompt or file name"
              className="w-full bg-transparent text-sm text-white placeholder-neutral-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3 lg:w-[430px]">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-2">
            <label className="sr-only" htmlFor="asset-type-filter">Type</label>
            <div className="relative">
              <select
                id="asset-type-filter"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as "all" | "image" | "video")}
                className="h-11 w-full appearance-none rounded-xl border border-neutral-800 bg-neutral-950/70 px-3 pr-8 text-sm text-white outline-none transition focus:border-neutral-600"
              >
                <option value="all">Type: All</option>
                <option value="image">Type: Images</option>
                <option value="video">Type: Videos</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
            </div>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-2 sm:col-span-1">
            <label className="sr-only" htmlFor="workspace-filter">Workspace</label>
            <div className="relative">
              <select
                id="workspace-filter"
                value={folderFilter}
                onChange={(e) => setFolderFilter(e.target.value)}
                className="h-11 w-full appearance-none rounded-xl border border-neutral-800 bg-neutral-950/70 px-3 pr-8 text-sm text-white outline-none transition focus:border-neutral-600"
              >
                <option value="all">All Workspaces</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
            </div>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-2">
            <label className="sr-only" htmlFor="sort-filter">Sort</label>
            <div className="relative">
              <select
                id="sort-filter"
                value={dateSort}
                onChange={(e) => setDateSort(e.target.value as "newest" | "oldest")}
                className="h-11 w-full appearance-none rounded-xl border border-neutral-800 bg-neutral-950/70 px-3 pr-8 text-sm text-white outline-none transition focus:border-neutral-600"
              >
                <option value="newest">Sort: Newest</option>
                <option value="oldest">Sort: Oldest</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Gallery</h2>
          <p className="text-sm text-neutral-400 mt-1">
            {filteredAssets.length} assets across {folders.length} workspace{folders.length === 1 ? "" : "s"}.
          </p>
        </div>
        <div className="text-sm text-neutral-500">
          {isAuthenticated ? "Signed in" : "Browsing as guest"}
        </div>
      </div>

      {loading ? (
        <GallerySkeleton />
      ) : filteredAssets.length === 0 ? (
        <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-dashed border-neutral-800 bg-neutral-900/40 text-center px-6 py-16">
          <div>
            <p className="text-neutral-400">No assets match your filters.</p>
          </div>
        </div>
      ) : (
        <div className="grid auto-rows-[160px] grid-cols-2 gap-1 sm:auto-rows-[180px] lg:grid-cols-4 xl:auto-rows-[205px]">
          {filteredAssets.map((asset, index) => (
            <GalleryCard key={asset.id} asset={asset} layoutClass={galleryTileClasses[index % galleryTileClasses.length]} onSelect={() => {
              setSelectedAsset(asset);
              setIsModalOpen(true);
            }} />
          ))}
        </div>
      )}

      {isModalOpen && selectedAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="relative mx-auto flex w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-950 shadow-2xl md:flex-row">
            <button
              type="button"
              onClick={handleModalClose}
              className="absolute right-4 top-4 z-20 rounded-full bg-neutral-900/80 p-3 text-neutral-300 transition hover:bg-neutral-800 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex-1 bg-black/60 p-6 flex items-center justify-center">
              {previewLoading ? (
                <Loader2 className="w-10 h-10 animate-spin text-accent" />
              ) : previewError ? (
                <div className="text-center">
                  <div className="text-sm text-red-400 mb-2">Preview unavailable</div>
                  <div className="text-xs text-neutral-500">{previewError}</div>
                </div>
              ) : previewUrl ? (
                selectedAsset.type === "video" ? (
                  <video
                    src={previewUrl}
                    controls
                    className="max-h-[80vh] max-w-full rounded-3xl"
                    playsInline
                  />
                ) : (
                  <img
                    src={previewUrl}
                    alt={selectedAsset.prompt}
                    className="max-h-[80vh] max-w-full rounded-3xl object-contain"
                  />
                )
              ) : (
                <div className="text-sm text-neutral-500">No preview available</div>
              )}
            </div>

            <div className="w-full md:w-[380px] border-t border-neutral-800 bg-neutral-950 p-6 md:border-t-0 md:border-l">
              <div className="space-y-6">
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">Workspace</div>
                  <p className="mt-2 text-sm text-white">{selectedFolderName}</p>
                </div>

                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">Prompt</div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(selectedAsset.prompt);
                    }}
                    className="mt-3 w-full text-left rounded-3xl border border-neutral-800 bg-neutral-900 p-4 text-sm text-neutral-200 transition hover:border-neutral-700"
                  >
                    <p className="line-clamp-4">{selectedAsset.prompt}</p>
                    <span className="mt-3 inline-flex items-center gap-2 text-xs text-accent">
                      <Sparkles className="w-3.5 h-3.5" /> Copy prompt
                    </span>
                  </button>
                </div>

                <div className="space-y-3 rounded-3xl border border-neutral-800 bg-neutral-900 p-4 text-sm text-neutral-400">
                  <div className="flex min-w-0 items-center justify-between gap-4">
                    <span className="shrink-0">File name</span>
                    <span className="min-w-0 truncate text-right text-white" title={selectedFileName}>
                      {selectedFileName}
                    </span>
                  </div>
                  {selectedAsset.metadata?.width && selectedAsset.metadata?.height && (
                    <div className="flex justify-between">
                      <span>Dimensions</span>
                      <span className="text-white">{selectedAsset.metadata.width} x {selectedAsset.metadata.height}</span>
                    </div>
                  )}
                  {selectedAsset.metadata?.duration && (
                    <div className="flex justify-between">
                      <span>Duration</span>
                      <span className="text-white">{selectedAsset.metadata.duration}s</span>
                    </div>
                  )}
                  {selectedAsset.metadata?.size && (
                    <div className="flex justify-between">
                      <span>Size</span>
                      <span className="text-white">{(Number(selectedAsset.metadata.size) / 1024 / 1024).toFixed(2)} MB</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Uploaded</span>
                    <span className="text-white">{formatDate(selectedAsset.created_at)}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={() => setIsLightboxOpen(true)}
                    className="flex items-center justify-center gap-2 rounded-3xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm text-white transition hover:border-neutral-700"
                  >
                    <Eye className="w-4 h-4" /> Fullscreen
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (!previewUrl) {
                        alert("Unable to download: preview URL not available. Check browser console for errors.");
                        return;
                      }
                      window.open(previewUrl, "_blank");
                    }}
                    disabled={!previewUrl || previewLoading}
                    className="flex items-center justify-center gap-2 rounded-3xl bg-accent px-4 py-3 text-sm font-semibold text-neutral-950 transition hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Download className="w-4 h-4" /> {previewLoading ? "Loading..." : "Download"}
                  </button>

                  <button
                    type="button"
                    onClick={handleRecreate}
                    disabled={!isAuthenticated}
                    className="group flex items-center justify-center gap-2 rounded-3xl border border-neutral-800 px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
                    title={isAuthenticated ? "Recreate this asset" : "Login required to recreate assets."}
                  >
                    <Sparkles className="w-4 h-4" />
                    {isAuthenticated ? "Recreate" : "Recreate (Login required)"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isLightboxOpen && selectedAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
          <div className="relative w-full max-w-7xl">
            <button
              type="button"
              onClick={() => setIsLightboxOpen(false)}
              className="absolute right-4 top-4 z-20 rounded-full bg-neutral-900/80 p-3 text-neutral-300 transition hover:bg-neutral-800 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex max-h-[90vh] flex-col items-center justify-center overflow-hidden rounded-3xl bg-neutral-950 p-4 md:flex-row md:p-6">
              <div className="flex-1 flex items-center justify-center">
                {previewLoading ? (
                  <Loader2 className="w-12 h-12 animate-spin text-accent" />
                ) : previewError ? (
                  <div className="text-center">
                    <div className="text-sm text-red-400 mb-2">Preview error</div>
                    <div className="text-xs text-neutral-500">{previewError}</div>
                  </div>
                ) : previewUrl ? (
                  selectedAsset.type === "video" ? (
                    <video
                      src={previewUrl}
                      controls
                      autoPlay
                      className="max-h-[80vh] max-w-full rounded-3xl"
                      playsInline
                    />
                  ) : (
                    <img
                      src={previewUrl}
                      alt={selectedAsset.prompt}
                      className="max-h-[80vh] max-w-full rounded-3xl object-contain"
                    />
                  )
                ) : (
                  <div className="text-sm text-neutral-500">No preview available</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
