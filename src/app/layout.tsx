import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Photographer Prompt Hub | Photography Inspiration & Generation Prompts",
  description:
    "Curated photography generation prompts, camera settings, and automated Instagram comment-to-DM delivery system.",
  keywords: [
    "photography prompts",
    "midjourney photography",
    "camera settings",
    "lighting setups",
    "instagram automation",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark antialiased`}
    >
      <body className="min-h-screen bg-[#090a0c] text-slate-100 flex flex-col font-sans">
        {children}
      </body>
    </html>
  );
}
