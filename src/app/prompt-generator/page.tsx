"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Sparkles,
  Copy,
  Check,
  Loader2,
  RefreshCw,
  History,
  FileText,
  AlertCircle,
} from "lucide-react";
import { dbService, PromptGeneration } from "@/lib/db";
import { getUserSession } from "@/lib/auth";

function PromptGeneratorContent() {
  const searchParams = useSearchParams();
  const prefill = searchParams.get("prefill");

  const [goal, setGoal] = useState("");
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isMock, setIsMock] = useState(false);
  const [history, setHistory] = useState<PromptGeneration[]>([]);
  const [authChecking, setAuthChecking] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Load history on mount
  const router = useRouter();

  useEffect(() => {
    async function ensureAuthAndLoad() {
      try {
        const session = await getUserSession();
        if (!session) {
          router.replace("/login?redirectTo=/prompt-generator");
          return;
        }
        await loadHistory();
        setAuthChecking(false);
      } catch {
        router.replace("/login?redirectTo=/prompt-generator");
      }
    }

    ensureAuthAndLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Set prefill text if provided
  useEffect(() => {
    if (prefill) {
      setGoal(prefill);
    }
  }, [prefill]);

  async function loadHistory() {
    try {
      setHistoryLoading(true);
      const data = await dbService.getPromptGenerations();
      setHistory(data);
    } catch (err) {
      console.error("Error loading generation history:", err);
    } finally {
      setHistoryLoading(false);
    }
  }

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goal.trim() || loading) return;

    try {
      setLoading(true);
      const res = await fetch("/api/openrouter/generate-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: goal.trim() }),
      });

      if (!res.ok) {
        throw new Error("Failed to call generation API");
      }

      const data = await res.json();
      setGeneratedPrompt(data.prompt);
      setIsMock(!!data.isMock);

      // If mock mode is running on the client as well, save to dbService (localStorage)
      // Otherwise, the API server handles the Supabase write
      await dbService.createPromptGeneration(goal.trim(), data.prompt);
      await loadHistory();
    } catch (err) {
      console.error(err);
      alert("Error generating prompt. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!generatedPrompt) return;
    navigator.clipboard.writeText(generatedPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyHistory = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (authChecking) {
    return (
      <div className="min-h-full p-8 flex flex-col gap-8 max-w-7xl mx-auto">
        <div className="space-y-3" aria-hidden="true">
          <div className="skeleton h-9 w-72 rounded" />
          <div className="skeleton h-4 w-96 max-w-full rounded" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="skeleton h-[420px] rounded-2xl border border-neutral-800" />
          <div className="skeleton h-[420px] rounded-2xl border border-neutral-800" />
        </div>
        <div className="space-y-3" aria-hidden="true">
          <div className="skeleton h-6 w-52 rounded" />
          <div className="skeleton h-24 rounded-xl border border-neutral-850" />
          <div className="skeleton h-24 rounded-xl border border-neutral-850" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full p-8 flex flex-col gap-8 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
          <Sparkles className="w-8 h-8 text-accent animate-pulse" />
          Prompt Generator
        </h1>
        <p className="text-neutral-400 text-sm mt-1">
          Translate campaign goals and content scripts into optimized generation prompts.
        </p>
      </div>

      {/* Main Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
        {/* Left Panel: Textarea Input */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 flex flex-col gap-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-400">
              Your Goal
            </h2>
            {goal && (
              <button
                onClick={() => setGoal("")}
                className="text-xs text-neutral-500 hover:text-white transition-colors"
              >
                Clear Brief
              </button>
            )}
          </div>

          <form onSubmit={handleGenerate} className="flex-1 flex flex-col gap-4">
            <textarea
              required
              rows={8}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Describe your creative vision, brand tone, or script outline. E.g., 'An aesthetic product shot of a skincare oil bottle nestled in dynamic water ripples with fresh fruit slices around it, dramatic side lighting...'"
              className="flex-1 w-full bg-neutral-950 border border-neutral-800 focus:border-accent rounded-xl p-4 text-white text-sm focus:outline-none transition-colors resize-none placeholder-neutral-600 leading-relaxed"
            />

            <button
              type="submit"
              disabled={loading || !goal.trim()}
              className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-neutral-950 font-bold py-3.5 rounded-xl transition-all duration-200 shadow-lg shadow-accent/5 active:scale-95"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Synthesizing Prompt...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>Generate Prompt</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Panel: Generated Output */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 flex flex-col gap-4 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-400">
              Generated Prompt
            </h2>
            {generatedPrompt && (
              <button
                onClick={handleCopy}
                className="text-xs text-accent hover:underline flex items-center gap-1 font-semibold"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-accent" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy to clipboard</span>
                  </>
                )}
              </button>
            )}
          </div>

          <div className="flex-1 bg-neutral-950 border border-neutral-850 rounded-xl p-5 relative overflow-y-auto min-h-[220px]">
            {generatedPrompt ? (
              <pre className="text-sm text-neutral-200 font-mono leading-relaxed whitespace-pre-wrap select-text h-full">
                {generatedPrompt}
              </pre>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <FileText className="w-12 h-12 text-neutral-800 mb-3" />
                <span className="text-neutral-500 text-sm">
                  Generated output will render here.
                </span>
              </div>
            )}
          </div>

          {/* Warning indicator for mock mode */}
          {isMock && generatedPrompt && (
            <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-950/20 border border-amber-900/30 px-3.5 py-2.5 rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>
                Running in Mock mode: Configure `OPENROUTER_API_KEY` for live AI completions.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* History log section */}
      <div className="border-t border-neutral-800 pt-8 mt-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
          <History className="w-5 h-5 text-neutral-400" />
          Recent Activity Log
        </h2>

        {historyLoading ? (
          <div className="space-y-3" aria-hidden="true">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="rounded-xl border border-neutral-850 bg-neutral-900/50 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <div className="skeleton h-5 w-12 rounded" />
                  <div className="skeleton h-4 w-1/3 rounded" />
                </div>
                <div className="space-y-2">
                  <div className="skeleton h-4 w-full rounded" />
                  <div className="skeleton h-4 w-4/5 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : history.length === 0 ? (
          <p className="text-neutral-600 text-xs">No recent completions recorded.</p>
        ) : (
          <div className="space-y-3">
            {history.slice(0, 5).map((item) => (
              <div
                key={item.id}
                className="bg-neutral-900/50 hover:bg-neutral-900 border border-neutral-850 p-4 rounded-xl flex items-start justify-between gap-4 transition-all"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[10px] uppercase font-bold text-neutral-500 bg-neutral-850 px-2 py-0.5 rounded">
                      Goal
                    </span>
                    <p className="text-xs font-semibold text-neutral-300 truncate">
                      {item.goal}
                    </p>
                  </div>
                  <p className="text-sm text-neutral-200 font-mono line-clamp-2">
                    {item.generated_prompt}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => {
                      setGoal(item.goal);
                      setGeneratedPrompt(item.generated_prompt);
                    }}
                    className="p-2 hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-white transition-colors"
                    title="Load into Editor"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleCopyHistory(item.generated_prompt)}
                    className="p-2 hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-white transition-colors"
                    title="Copy Prompt"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PromptGeneratorPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen p-8">
          <div className="mx-auto flex max-w-7xl flex-col gap-8">
            <div className="space-y-3">
              <div className="skeleton h-9 w-72 rounded" />
              <div className="skeleton h-4 w-96 max-w-full rounded" />
            </div>
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              <div className="skeleton h-[420px] rounded-2xl border border-neutral-800" />
              <div className="skeleton h-[420px] rounded-2xl border border-neutral-800" />
            </div>
          </div>
        </div>
      }
    >
      <PromptGeneratorContent />
    </Suspense>
  );
}
