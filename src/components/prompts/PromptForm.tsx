"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { slugify, PHOTOGRAPHY_CATEGORIES } from "@/lib/utils";
import { Sparkles, Save, ArrowLeft, Camera, Sliders, ExternalLink } from "lucide-react";
import Link from "next/link";
import type { PromptItem } from "@/types";

interface PromptFormProps {
  initialData?: Partial<PromptItem>;
  isEditing?: boolean;
}

export function PromptForm({ initialData, isEditing }: PromptFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState(initialData?.title || "");
  const [originalPrompt, setOriginalPrompt] = useState(initialData?.originalPrompt || "");
  const [category, setCategory] = useState(initialData?.category || PHOTOGRAPHY_CATEGORIES[0]);
  const [tagsInput, setTagsInput] = useState(initialData?.tags?.join(", ") || "");
  const [slug, setSlug] = useState(initialData?.slug || "");
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(Boolean(initialData?.slug));

  // Generation settings
  const [aspectRatio, setAspectRatio] = useState(initialData?.generationSettings?.aspectRatio || "4:5");
  const [camera, setCamera] = useState(initialData?.generationSettings?.camera || "Canon EOS R5");
  const [lens, setLens] = useState(initialData?.generationSettings?.lens || "85mm f/1.2L");
  const [lighting, setLighting] = useState(initialData?.generationSettings?.lighting || "Diffused golden hour rim light");
  const [engine, setEngine] = useState(initialData?.generationSettings?.engine || "Midjourney v6.1");

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!isSlugManuallyEdited) {
      setSlug(slugify(val));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim() || !originalPrompt.trim()) {
      setError("Please provide a title and generation prompt.");
      return;
    }

    try {
      setLoading(true);

      const payload = {
        title: title.trim(),
        originalPrompt: originalPrompt.trim(),
        category,
        tags: tagsInput
          .split(",")
          .map((t) => t.trim().toLowerCase().replace(/^#/, ""))
          .filter(Boolean),
        slug: slugify(slug || title),
        generationSettings: {
          aspectRatio,
          camera,
          lens,
          lighting,
          engine,
        },
      };

      const url = isEditing ? `/api/prompts/${initialData?.id}` : "/api/prompts";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to save prompt");
      }

      router.push("/prompts");
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      {error && (
        <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
          {error}
        </div>
      )}

      {/* Main Prompt Details */}
      <div className="p-6 rounded-xl bg-[#111317] border border-[#21252e] space-y-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span>Core Prompt Details</span>
        </h2>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            Prompt Title *
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="e.g. Golden Hour Tuscan Vineyard Bridal Portrait"
            className="w-full px-3.5 py-2.5 bg-[#14171f] border border-[#222834] rounded-lg text-xs text-white placeholder-slate-500 focus:border-amber-500 transition-colors"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Photography Category *
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#14171f] border border-[#222834] rounded-lg text-xs text-white focus:border-amber-500 transition-colors cursor-pointer"
            >
              {PHOTOGRAPHY_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Public Page Slug *
            </label>
            <div className="flex items-center">
              <span className="px-3 py-2.5 bg-[#1b1f2a] border border-r-0 border-[#222834] rounded-l-lg text-xs text-slate-500 font-mono">
                /p/
              </span>
              <input
                type="text"
                required
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setIsSlugManuallyEdited(true);
                }}
                placeholder="golden-hour-tuscan-vineyard-bridal"
                className="w-full px-3.5 py-2.5 bg-[#14171f] border border-[#222834] rounded-r-lg text-xs text-amber-400 font-mono placeholder-slate-500 focus:border-amber-500 transition-colors"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              This slug forms the link automatically delivered to Instagram commenters.
            </p>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-slate-300">
              Full Original Generation Prompt *
            </label>
            <span className="text-[11px] text-amber-500/80 font-mono">
              Never modified by AI
            </span>
          </div>
          <textarea
            required
            rows={5}
            value={originalPrompt}
            onChange={(e) => setOriginalPrompt(e.target.value)}
            placeholder="High-end editorial bridal portrait in a rolling Tuscan vineyard at golden hour, bride wearing an intricate ivory lace backless gown..."
            className="w-full px-3.5 py-2.5 bg-[#14171f] border border-[#222834] rounded-lg text-xs text-slate-200 font-mono leading-relaxed placeholder-slate-600 focus:border-amber-500 transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            Tags (comma-separated)
          </label>
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="bridal, tuscan, golden-hour, canon-85mm, cinematic"
            className="w-full px-3.5 py-2.5 bg-[#14171f] border border-[#222834] rounded-lg text-xs text-white placeholder-slate-500 focus:border-amber-500 transition-colors"
          />
        </div>
      </div>

      {/* Generation Settings Card */}
      <div className="p-6 rounded-xl bg-[#111317] border border-[#21252e] space-y-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Camera className="w-4 h-4 text-amber-500" />
          <span>Camera & Lighting Settings (Public Metadata)</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Aspect Ratio
            </label>
            <select
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#14171f] border border-[#222834] rounded-lg text-xs text-white focus:border-amber-500 transition-colors"
            >
              <option value="4:5">4:5 (Instagram Portrait)</option>
              <option value="1:1">1:1 (Square)</option>
              <option value="16:9">16:9 (Cinematic Widescreen)</option>
              <option value="9:16">9:16 (Stories / Reels)</option>
              <option value="3:2">3:2 (Classic 35mm)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Camera Body
            </label>
            <input
              type="text"
              value={camera}
              onChange={(e) => setCamera(e.target.value)}
              placeholder="e.g. Canon EOS R5 / Leica M11"
              className="w-full px-3.5 py-2.5 bg-[#14171f] border border-[#222834] rounded-lg text-xs text-white placeholder-slate-500 focus:border-amber-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Focal Length & Lens
            </label>
            <input
              type="text"
              value={lens}
              onChange={(e) => setLens(e.target.value)}
              placeholder="e.g. 85mm f/1.2 / 50mm f/0.95"
              className="w-full px-3.5 py-2.5 bg-[#14171f] border border-[#222834] rounded-lg text-xs text-white placeholder-slate-500 focus:border-amber-500 transition-colors"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Lighting Setup
            </label>
            <input
              type="text"
              value={lighting}
              onChange={(e) => setLighting(e.target.value)}
              placeholder="e.g. Soft diffused north-facing window + gold reflector"
              className="w-full px-3.5 py-2.5 bg-[#14171f] border border-[#222834] rounded-lg text-xs text-white placeholder-slate-500 focus:border-amber-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Target AI Engine / Diffusion Model
            </label>
            <input
              type="text"
              value={engine}
              onChange={(e) => setEngine(e.target.value)}
              placeholder="e.g. Midjourney v6.1 / Flux.1 Dev"
              className="w-full px-3.5 py-2.5 bg-[#14171f] border border-[#222834] rounded-lg text-xs text-white placeholder-slate-500 focus:border-amber-500 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex items-center justify-between pt-2">
        <Link
          href="/prompts"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#242936] text-xs text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Cancel</span>
        </Link>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold transition-all hover:scale-[1.02] disabled:opacity-50"
        >
          <Save className="w-4 h-4 stroke-[2.5]" />
          <span>{loading ? "Saving..." : isEditing ? "Save Changes" : "Create Prompt"}</span>
        </button>
      </div>
    </form>
  );
}
