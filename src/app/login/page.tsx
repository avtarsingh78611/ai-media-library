"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, ArrowLeftRight } from "lucide-react";
import { signInWithEmail, signUpWithEmail, getUserSession } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [redirectTo, setRedirectTo] = useState("/my-work");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setRedirectTo(params.get("redirectTo") || "/my-work");
  }, []);

  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function checkSession() {
      try {
        const session = await getUserSession();
        if (session) {
          router.replace(redirectTo);
        }
      } catch (err) {
        console.warn("No active session", err);
      }
    }

    checkSession();
  }, [router, redirectTo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      if (isRegister) {
        const response = await signUpWithEmail(email, password);
        if (response?.user) {
          setMessage("Check your email to confirm registration.");
        } else {
          setMessage("Registration started. Please verify your email.");
        }
      } else {
        await signInWithEmail(email, password);
        router.replace(redirectTo);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl p-8 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">{isRegister ? "Create account" : "Sign in"}</h1>
            <p className="text-sm text-neutral-400 mt-1">
              {isRegister ? "Register to access your media workspace." : "Login to manage folders and uploads."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsRegister(!isRegister)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-neutral-800 text-neutral-300 hover:text-white hover:border-neutral-700 transition-all"
          >
            <ArrowLeftRight className="w-4 h-4" />
            {isRegister ? "Sign in" : "Register"}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-xs uppercase tracking-[0.3em] text-neutral-500">
            Email
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-sm text-white outline-none focus:border-accent"
            />
          </label>

          <label className="block text-xs uppercase tracking-[0.3em] text-neutral-500">
            Password
            <input
              type="password"
              autoComplete={isRegister ? "new-password" : "current-password"}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-sm text-white outline-none focus:border-accent"
            />
          </label>

          {error && (
            <div className="rounded-2xl bg-red-950/70 border border-red-900 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {message && (
            <div className="rounded-2xl bg-green-950/70 border border-emerald-900 px-4 py-3 text-sm text-emerald-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>{message}</span>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-accent py-3 text-sm font-semibold text-neutral-950 transition-all hover:bg-accent-hover disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
            <span>{isRegister ? "Register" : "Continue"}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
