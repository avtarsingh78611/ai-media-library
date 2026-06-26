import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "MediaLib AI - Premium Media Library",
  description: "Manage your folders, generated scripts, and AI media assets in a dark-themed visual workspace.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-neutral-950 text-neutral-200 min-h-screen flex overflow-hidden`}
      >
        <Sidebar />
        <main className="flex-1 h-screen overflow-y-auto bg-neutral-950">
          {children}
        </main>
      </body>
    </html>
  );
}
