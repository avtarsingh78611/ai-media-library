"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FolderPlus, Folder, ChevronRight, Search, Loader2, Calendar } from "lucide-react";
import { dbService, Folder as FolderType, getErrorMessage } from "@/lib/db";
import { getUserSession } from "@/lib/auth";

export default function MyWorkPage() {
  const [folders, setFolders] = useState<FolderType[]>([]);
  const [assetCounts, setAssetCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const router = useRouter();

  useEffect(() => {
    async function ensureAuthAndLoad() {
      try {
        const session = await getUserSession();
        if (!session) {
          router.replace("/login?redirectTo=/my-work");
          return;
        }

        await loadFolders();
      } catch {
        router.replace("/login?redirectTo=/my-work");
      }
    }

    ensureAuthAndLoad();
  }, [router]);

  async function loadFolders() {
    try {
      setLoading(true);
      const data = await dbService.getFolders();
      setFolders(data);
      
      // Load asset counts for each folder in parallel
      const counts: Record<string, number> = {};
      await Promise.all(
        data.map(async (folder) => {
          const assets = await dbService.getAssets(folder.id);
          counts[folder.id] = assets.length;
        })
      );
      setAssetCounts(counts);
    } catch (err) {
      console.error("Error loading folders:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateFolder(e: React.FormEvent) {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    try {
      setCreating(true);
      setError("");
      await dbService.createFolder(newFolderName.trim());
      setNewFolderName("");
      setIsDialogOpen(false);
      await loadFolders();
    } catch (err) {
      const message = getErrorMessage(err);
      console.error("Error creating folder:", message, err);
      setError(message);
    } finally {
      setCreating(false);
    }
  }

  const filteredFolders = folders.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-full p-8 flex flex-col gap-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">My Work</h1>
          <p className="text-neutral-400 text-sm mt-1">
            Organize and manage your brand assets, prompts, and video scripts.
          </p>
        </div>
        <button
          onClick={() => setIsDialogOpen(true)}
          className="flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-neutral-950 px-5 py-3 rounded-xl font-semibold shadow-lg shadow-accent/10 transition-all duration-200 shrink-0 transform active:scale-95"
        >
          <FolderPlus className="w-5 h-5" />
          <span>New Folder</span>
        </button>
      </div>

      {/* Search and Stats */}
      <div className="flex items-center bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 gap-3 focus-within:border-accent/50 transition-colors max-w-md">
        <Search className="w-5 h-5 text-neutral-500" />
        <input
          type="text"
          placeholder="Search folders..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-transparent text-white placeholder-neutral-500 text-sm focus:outline-none w-full"
        />
      </div>

      {/* Grid Content */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
          <p className="text-neutral-400 text-sm">Loading workspace...</p>
        </div>
      ) : filteredFolders.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-24 border border-dashed border-neutral-800 rounded-2xl bg-neutral-900/20 text-center px-4">
          <Folder className="w-12 h-12 text-neutral-600 mb-4" />
          <h3 className="text-lg font-bold text-neutral-200">No folders found</h3>
          <p className="text-neutral-500 text-sm mt-1 max-w-xs mx-auto">
            {searchQuery
              ? "No folders match your search query."
              : "Create your first brand folder to start organizing media assets."}
          </p>
          {!searchQuery && (
            <button
              onClick={() => setIsDialogOpen(true)}
              className="mt-5 text-accent hover:underline font-medium text-sm flex items-center gap-1.5"
            >
              Create Folder <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredFolders.map((folder) => {
            const count = assetCounts[folder.id] || 0;
            const dateStr = new Date(folder.created_at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            });
            return (
              <Link
                key={folder.id}
                href={`/my-work/${folder.id}`}
                className="group flex flex-col bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded-2xl p-6 transition-all duration-350 hover:shadow-xl hover:shadow-neutral-950/50 relative overflow-hidden"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-neutral-800/80 text-accent group-hover:bg-accent group-hover:text-neutral-950 transition-all duration-350">
                    <Folder className="w-6 h-6" />
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-neutral-800 text-neutral-400 group-hover:bg-neutral-800/50 transition-colors">
                    {count} {count === 1 ? "asset" : "assets"}
                  </span>
                </div>

                <div className="mt-5">
                  <h3 className="text-lg font-bold text-white group-hover:text-accent transition-colors truncate">
                    {folder.name}
                  </h3>
                  <p className="text-xs text-neutral-500 mt-1 truncate">
                    slug: /{folder.slug}
                  </p>
                </div>

                {/* Footer details */}
                <div className="mt-8 pt-4 border-t border-neutral-800/50 flex items-center justify-between text-xs text-neutral-500">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    {dateStr}
                  </span>
                  <span className="font-semibold text-accent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center gap-0.5">
                    Open <ChevronRight className="w-3 h-3" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Dialog Overlay */}
      {isDialogOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 border border-neutral-850 rounded-2xl w-full max-w-md shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-white">Create New Folder</h3>
            <p className="text-neutral-400 text-xs mt-1">
              Folders contain image and video assets for a specific brand campaign.
            </p>

            <form onSubmit={handleCreateFolder} className="mt-5 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                  Folder Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. A2 Care"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-accent rounded-xl px-4 py-3 text-white text-sm focus:outline-none transition-colors"
                  autoFocus
                />
              </div>

              {error && (
                <div className="text-red-400 text-xs bg-red-950/20 border border-red-900/30 px-3 py-2.5 rounded-lg">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-neutral-800/50">
                <button
                  type="button"
                  onClick={() => {
                    setIsDialogOpen(false);
                    setError("");
                    setNewFolderName("");
                  }}
                  className="px-4 py-2.5 rounded-xl border border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800/30 text-sm font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex items-center justify-center gap-1.5 bg-accent hover:bg-accent-hover text-neutral-950 px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors disabled:opacity-50"
                >
                  {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{creating ? "Creating..." : "Create Folder"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
