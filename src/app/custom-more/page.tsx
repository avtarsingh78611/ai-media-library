"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Layers, Video, ShoppingCart, BarChart3, ChevronRight, Sparkles } from "lucide-react";

export default function CustomMorePage() {
  const router = useRouter();

  const sections = [
    {
      id: "ugc",
      title: "UGC Creator Video",
      description:
        "Draft complete video campaigns including multi-perspective reference images, high-retention TikTok scripts, and voiceover captions.",
      thumbnail:
        "https://images.unsplash.com/photo-1626379616459-b2ce1d9decbc?auto=format&fit=crop&w=600&q=80",
      icon: Video,
      route: "/custom-more/ugc-video",
      badge: "High Conversion",
    },
    {
      id: "marketing",
      title: "Marketing Suite",
      description:
        "Generate multi-channel ad copy, email sequences, and aesthetic branding kits for upcoming product launches.",
      thumbnail:
        "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=600&q=80",
      icon: BarChart3,
      route: "#",
      badge: "Coming Soon",
    },
    {
      id: "ecommerce",
      title: "Ecommerce Catalog",
      description:
        "Produce high-fidelity isolated product mockups, white-background catalog shots, and engaging Amazon listing copy.",
      thumbnail:
        "https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=600&q=80",
      icon: ShoppingCart,
      route: "#",
      badge: "Coming Soon",
    },
  ];

  const handleAction = (section: typeof sections[0]) => {
    if (section.route === "#") {
      alert(`${section.title} module is currently in active development. Try out UGC Creator Video!`);
    } else {
      router.push(section.route);
    }
  };

  return (
    <div className="min-h-full p-8 flex flex-col gap-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
          <Layers className="w-8 h-8 text-accent" />
          Custom More
        </h1>
        <p className="text-neutral-400 text-sm mt-1">
          Access specialized AI creation suits tailored for content marketing, UGC production, and ecommerce.
        </p>
      </div>

      {/* Grid of Section Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {sections.map((section) => {
          const Icon = section.icon;
          const isUgc = section.id === "ugc";

          return (
            <div
              key={section.id}
              className="group bg-neutral-900 border border-neutral-800 hover:border-neutral-750 rounded-2xl overflow-hidden flex flex-col shadow-xl transition-all duration-300 hover:shadow-neutral-950/40"
            >
              {/* Thumbnail Container */}
              <div className="relative h-48 overflow-hidden bg-neutral-950">
                <img
                  src={section.thumbnail}
                  alt={section.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80 group-hover:opacity-100"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-neutral-900 via-neutral-900/40 to-transparent" />
                
                {/* Badge Overlay */}
                <div className="absolute top-3 right-3">
                  <span
                    className={`text-[10px] uppercase font-extrabold tracking-wider px-2.5 py-1.5 rounded-lg border ${
                      isUgc
                        ? "bg-accent/15 border-accent/20 text-accent"
                        : "bg-neutral-800/80 border-neutral-700 text-neutral-400"
                    }`}
                  >
                    {section.badge}
                  </span>
                </div>

                {/* Floating Icon */}
                <div className="absolute bottom-3 left-4 flex items-center justify-center w-10 h-10 rounded-xl bg-neutral-900/90 text-accent border border-neutral-850">
                  <Icon className="w-5 h-5" />
                </div>
              </div>

              {/* Card Body */}
              <div className="p-6 flex-1 flex flex-col gap-4">
                <div>
                  <h3 className="text-xl font-bold text-white group-hover:text-accent transition-colors">
                    {section.title}
                  </h3>
                  <p className="text-neutral-400 text-sm mt-2.5 leading-relaxed">
                    {section.description}
                  </p>
                </div>

                {/* Button Action */}
                <div className="mt-auto pt-4">
                  <button
                    onClick={() => handleAction(section)}
                    className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${
                      isUgc
                        ? "bg-accent hover:bg-accent-hover text-neutral-950 shadow-md shadow-accent/5 active:scale-97"
                        : "bg-neutral-950 hover:bg-neutral-950/70 border border-neutral-800 text-neutral-500 hover:text-neutral-300"
                    }`}
                  >
                    <span>Generate</span>
                    <ChevronRight className="w-4 h-4 shrink-0" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick guide details */}
      <div className="bg-neutral-900/30 border border-neutral-850 rounded-2xl p-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mt-4">
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-lg bg-neutral-800 flex items-center justify-center text-accent shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">Need a custom AI creator pipeline?</h4>
            <p className="text-xs text-neutral-400 mt-0.5">
              We can wire custom workflows, APIs, and models for your enterprise agency.
            </p>
          </div>
        </div>
        <button
          onClick={() => alert("Please coordinate with your Antigravity AI partner to build custom scripts!")}
          className="text-xs font-semibold text-accent hover:underline shrink-0"
        >
          Contact Developer Support
        </button>
      </div>
    </div>
  );
}
