"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  FolderKanban,
  Sparkles,
  Layers,
  ChevronLeft,
  ChevronRight,
  Library,
  LogOut,
  User,
} from "lucide-react";
import { getUser, signOutUser } from "@/lib/auth";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    async function loadUser() {
      try {
        const user = await getUser();
        setUserEmail(user?.email || null);
      } catch {
        setUserEmail(null);
      }
    }
    loadUser();
  }, []);

  const navItems = [
    {
      label: "Gallery",
      href: "/",
      icon: Library,
    },
    {
      label: "My Work",
      href: "/my-work",
      icon: FolderKanban,
    },
    {
      label: "Prompt Generator",
      href: "/prompt-generator",
      icon: Sparkles,
    },
    {
      label: "Custom More",
      href: "/custom-more",
      icon: Layers,
    },
  ];

  return (
    <aside
      className={`relative h-screen bg-neutral-950 border-r border-neutral-800 flex flex-col transition-all duration-300 ${
        isCollapsed ? "w-16" : "w-[220px]"
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center px-4 border-b border-neutral-800 gap-3 overflow-hidden select-none">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent text-neutral-950 font-extrabold shrink-0">
          <Library className="w-5 h-5" />
        </div>
        {!isCollapsed && (
          <span className="font-bold text-white text-base tracking-wide whitespace-nowrap">
            Media<span className="text-accent">Lib AI</span>
          </span>
        )}
      </div>

      {/* Nav Items */}
      <nav className="flex-1 py-6 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group relative ${
                isActive
                  ? "bg-neutral-900 text-accent font-semibold shadow-inner"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50"
              }`}
            >
              <Icon
                className={`w-5 h-5 transition-transform duration-200 shrink-0 ${
                  isActive ? "text-accent" : "group-hover:scale-105"
                }`}
              />
              {!isCollapsed && (
                <span className="text-sm tracking-wide">{item.label}</span>
              )}
              
              {/* Highlight active strip */}
              {isActive && (
                <span className="absolute left-0 top-1/4 bottom-1/4 w-1 rounded-r-md bg-accent" />
              )}

              {/* Tooltip for collapsed mode */}
              {isCollapsed && (
                <div className="absolute left-14 ml-2 px-2.5 py-1.5 bg-neutral-900 border border-neutral-800 text-xs text-white rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 whitespace-nowrap shadow-xl">
                  {item.label}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-neutral-800 space-y-3">
        <div className="flex items-center gap-3 rounded-2xl border border-neutral-800 bg-neutral-900/70 p-3">
          <div className="w-10 h-10 rounded-2xl bg-neutral-800 flex items-center justify-center text-accent">
            <User className="w-5 h-5" />
          </div>
          {!isCollapsed ? (
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{userEmail || "Guest"}</p>
              <p className="text-xs text-neutral-500">Logged in user</p>
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={async () => {
            await signOutUser();
            router.replace("/login");
          }}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-neutral-850 bg-neutral-900 hover:bg-neutral-900/80 text-neutral-300 hover:text-white transition-all duration-200"
        >
          <LogOut className="w-4 h-4" />
          {!isCollapsed && <span className="text-sm">Sign Out</span>}
        </button>

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full flex items-center justify-center py-2.5 rounded-xl border border-neutral-850 hover:border-neutral-800 hover:bg-neutral-900/50 text-neutral-400 hover:text-neutral-200 transition-all duration-200"
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <div className="flex items-center gap-2">
              <ChevronLeft className="w-5 h-5" />
              <span className="text-xs">Collapse</span>
            </div>
          )}
        </button>
      </div>
    </aside>
  );
}
