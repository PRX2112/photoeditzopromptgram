import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { dbService } from "@/lib/db-service";
import { CopyPromptButton } from "@/components/public/CopyPromptButton";
import { InstagramEmbed } from "@/components/public/InstagramEmbed";
import {
  Camera,
  Layers,
  Sparkles,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { slug } = await props.params;
  const prompt = await dbService.getPromptBySlug(slug);

  if (!prompt || prompt.isArchived) {
    return {
      title: "Prompt Not Found | Photographer Prompt Hub",
      robots: { index: false, follow: false },
    };
  }

  return {
    title: `${prompt.title} | Photography AI Prompt`,
    description: `Full generation prompt for ${prompt.category || "photography"}: ${prompt.title}`,
    openGraph: {
      title: prompt.title,
      description: prompt.originalPrompt.slice(0, 160),
      type: "article",
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function PublicPromptPage(props: PageProps) {
  const { slug } = await props.params;
  const prompt = await dbService.getPromptBySlug(slug);

  if (!prompt || prompt.isArchived) {
    notFound();
  }

  const isPublished = Boolean(prompt.latestPost?.instagramPermalink);
  const permalink = prompt.latestPost?.instagramPermalink;

  return (
    <div className="min-h-screen bg-[#07080a] text-slate-100 flex flex-col justify-between selection:bg-amber-500 selection:text-black">
      {/* Top Header */}
      <header className="border-b border-[#1b1f29] bg-[#0c0e13]/80 backdrop-blur-md px-6 py-4 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 group-hover:scale-105 transition-transform">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <span className="text-sm font-semibold tracking-tight text-white block">
                Photographer Prompt Hub
              </span>
              <span className="text-[10px] text-amber-500/80 font-mono tracking-wider uppercase">
                Curated Generation Prompts
              </span>
            </div>
          </Link>

          <span className="text-xs font-mono text-slate-400 hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#141822] border border-[#232938]">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Master Prompt Edition</span>
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl w-full mx-auto px-6 py-10 md:py-16 space-y-8">
        {/* Category & Status Badge */}
        <div className="flex flex-wrap items-center gap-2.5">
          {prompt.category && prompt.category !== "Uncategorized" && (
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/25">
              {prompt.category}
            </span>
          )}
          {isPublished && (
            <span className="px-3 py-1 rounded-full text-xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Published on Instagram</span>
            </span>
          )}
        </div>

        {/* Title */}
        <div className="space-y-2">
          <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight text-white leading-tight">
            {prompt.title}
          </h1>
          <p className="text-xs text-slate-500 font-mono">
            Published {formatDate(prompt.createdAt)} &bull; {prompt.copyCount} photographers copied this prompt
          </p>
        </div>

        {/* Prompt Card with Prominent Copy Button */}
        <div className="p-6 md:p-8 rounded-2xl bg-[#0f1117] border border-[#232835] shadow-2xl relative space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-mono tracking-wider text-slate-400 font-semibold flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-amber-500" />
              <span>Canonical Generation Prompt</span>
            </span>
            <span className="text-[11px] text-amber-500 font-mono">
              Verbatim Creative Asset
            </span>
          </div>

          <div className="p-5 rounded-xl bg-[#08090c] border border-[#1b1f29] font-mono text-xs md:text-sm text-slate-200 leading-relaxed select-all">
            {prompt.originalPrompt}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <CopyPromptButton promptText={prompt.originalPrompt} slug={prompt.slug} />

            {permalink && (
              <a
                href={permalink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#141822] hover:bg-[#1c2230] text-slate-300 text-xs font-medium border border-[#232938] transition-colors"
              >
                <span>View on Instagram</span>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              </a>
            )}
          </div>
        </div>

        {/* Official Instagram Embed (Only after publication) */}
        {isPublished && permalink && (
          <InstagramEmbed permalink={permalink} publishedAt={prompt.latestPost?.publishedAt} />
        )}

        {/* Optional Optical / Camera Settings (Only rendered if present) */}
        {(prompt.cameraModel ||
          prompt.lens ||
          prompt.focalLength ||
          prompt.aperture ||
          prompt.shutterSpeed ||
          prompt.iso ||
          prompt.lightingSetup ||
          prompt.renderingEngine ||
          prompt.generationSettings) && (
          <div className="p-6 rounded-2xl bg-[#0f1117] border border-[#232835] space-y-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Camera className="w-4 h-4 text-amber-500" />
              <span>Camera & Technical Configuration</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs font-mono">
              {(prompt.cameraModel || prompt.generationSettings?.camera) && (
                <div className="p-3.5 rounded-xl bg-[#13161f] border border-[#202534]">
                  <span className="text-slate-500 text-[11px] block mb-1">Camera Sensor</span>
                  <span className="text-slate-200 font-semibold">
                    {prompt.cameraModel || prompt.generationSettings?.camera}
                  </span>
                </div>
              )}
              {(prompt.lens || prompt.generationSettings?.lens) && (
                <div className="p-3.5 rounded-xl bg-[#13161f] border border-[#202534]">
                  <span className="text-slate-500 text-[11px] block mb-1">Focal Length & Lens</span>
                  <span className="text-slate-200 font-semibold">
                    {prompt.lens || prompt.generationSettings?.lens}
                  </span>
                </div>
              )}
              {(prompt.aperture || prompt.focalLength) && (
                <div className="p-3.5 rounded-xl bg-[#13161f] border border-[#202534]">
                  <span className="text-slate-500 text-[11px] block mb-1">Aperture & Specs</span>
                  <span className="text-amber-400 font-semibold">
                    {[prompt.focalLength, prompt.aperture].filter(Boolean).join(" ")}
                  </span>
                </div>
              )}
              {(prompt.lightingSetup || prompt.generationSettings?.lighting) && (
                <div className="sm:col-span-2 p-3.5 rounded-xl bg-[#13161f] border border-[#202534]">
                  <span className="text-slate-500 text-[11px] block mb-1">Lighting Design</span>
                  <span className="text-slate-200 font-semibold">
                    {prompt.lightingSetup || prompt.generationSettings?.lighting}
                  </span>
                </div>
              )}
              {(prompt.renderingEngine || prompt.generationSettings?.engine) && (
                <div className="p-3.5 rounded-xl bg-[#13161f] border border-[#202534]">
                  <span className="text-slate-500 text-[11px] block mb-1">Target Engine</span>
                  <span className="text-slate-200 font-semibold">
                    {prompt.renderingEngine || prompt.generationSettings?.engine}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tags */}
        {prompt.tags && prompt.tags.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs font-medium text-slate-400 block">Related Tags</span>
            <div className="flex flex-wrap gap-1.5">
              {prompt.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 rounded-lg text-xs font-mono bg-[#11141b] text-slate-400 border border-[#1e232e]"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Public Footer */}
      <footer className="border-t border-[#1b1f29] bg-[#090b0e] px-6 py-8 text-center text-xs text-slate-500 space-y-2">
        <p>Curated for professional photographers & visual creators.</p>
        <p className="font-mono text-[11px] text-slate-600">
          Powered by Photographer Prompt Hub &bull; Meta Instagram API Integration
        </p>
      </footer>
    </div>
  );
}
