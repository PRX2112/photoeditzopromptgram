import type { Metadata } from "next";
import "./globals.css";

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
      suppressHydrationWarning
      className="dark antialiased"
    >
      <body
        suppressHydrationWarning
        className="min-h-screen bg-[#090a0c] text-slate-100 flex flex-col font-sans"
      >
        {children}
      </body>
    </html>
  );
}
