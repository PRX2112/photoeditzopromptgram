"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { normalizeSlug } from "@/lib/slugs";
import { PHOTOGRAPHY_CATEGORIES } from "@/lib/utils";
import {
  Sparkles,
  Save,
  ArrowLeft,
  Camera,
  Upload,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  ImageIcon,
  Check,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import type { PromptItem } from "@/types";

interface PromptFormProps {
  initialData?: Partial<PromptItem>;
  isEditing?: boolean;
}

export function PromptForm({ initialData, isEditing }: PromptFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Core Required Fields
  const [title, setTitle] = useState(initialData?.title || "");
  const [originalPrompt, setOriginalPrompt] = useState(initialData?.originalPrompt || "");
  const [slug, setSlug] = useState(initialData?.slug || "");
  const [isSlugLocked, setIsSlugLocked] = useState(Boolean(initialData?.slug));

  // Source Image State (Required)
  const [sourceImageUrl, setSourceImageUrl] = useState(initialData?.sourceImageUrl || "");
  const [sourceBlobPathname, setSourceBlobPathname] = useState(initialData?.sourceBlobPathname || "");
  const [sourceContentType, setSourceContentType] = useState(initialData?.sourceContentType || "");
  const [sourceImageSize, setSourceImageSize] = useState<number | undefined>(initialData?.sourceImageSize || undefined);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(initialData?.sourceImageUrl || "");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageInputMode, setImageInputMode] = useState<"upload" | "url">("upload");
  const [directUrlInput, setDirectUrlInput] = useState("");

  // Optional Collapsible Metadata State
  const hasExistingMetadata = Boolean(
    initialData?.cameraModel ||
      initialData?.lens ||
      initialData?.focalLength ||
      initialData?.aperture ||
      initialData?.shutterSpeed ||
      initialData?.iso ||
      initialData?.lightingSetup ||
      initialData?.renderingEngine ||
      (initialData?.category && initialData.category !== "Uncategorized")
  );

  const [showMetadata, setShowMetadata] = useState(hasExistingMetadata);
  const [category, setCategory] = useState(initialData?.category || "Uncategorized");
  const [tagsInput, setTagsInput] = useState(initialData?.tags?.join(", ") || "");
  const [cameraModel, setCameraModel] = useState(initialData?.cameraModel || "");
  const [lens, setLens] = useState(initialData?.lens || "");
  const [focalLength, setFocalLength] = useState(initialData?.focalLength || "");
  const [aperture, setAperture] = useState(initialData?.aperture || "");
  const [shutterSpeed, setShutterSpeed] = useState(initialData?.shutterSpeed || "");
  const [iso, setIso] = useState(initialData?.iso || "");
  const [lightingSetup, setLightingSetup] = useState(initialData?.lightingSetup || "");
  const [renderingEngine, setRenderingEngine] = useState(initialData?.renderingEngine || "");

  // Title change updates slug automatically only if not locked
  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!isSlugLocked) {
      setSlug(normalizeSlug(val));
    }
  };

  const handleRegenerateSlug = () => {
    const freshSlug = normalizeSlug(title);
    setSlug(freshSlug);
    setIsSlugLocked(true);
  };

  // Image Upload Handler
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    const localUrl = URL.createObjectURL(file);
    setImagePreviewUrl(localUrl);

    try {
      setUploadingImage(true);
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || "Failed to upload image");
      }

      const publicUrl = json.publicUrl || json.blobUrl || "";
      setSourceImageUrl(publicUrl);
      setSourceBlobPathname(json.pathname || "");
      setSourceContentType(json.contentType || file.type);
      setSourceImageSize(json.size || file.size);
      setImagePreviewUrl(publicUrl);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Image upload failed";
      setError(msg);
      setImagePreviewUrl(sourceImageUrl || "");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleApplyDirectUrl = () => {
    if (!directUrlInput || !directUrlInput.startsWith("http")) {
      setError("Please provide a valid https:// image URL");
      return;
    }
    setSourceImageUrl(directUrlInput);
    setImagePreviewUrl(directUrlInput);
    setSourceBlobPathname("");
    setSourceContentType("image/jpeg");
    setDirectUrlInput("");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Prompt Title is required.");
      return;
    }

    if (!sourceImageUrl) {
      setError("Source image is required. Please upload an image or provide a public URL.");
      return;
    }

    if (!originalPrompt.trim()) {
      setError("Original photography prompt is required.");
      return;
    }

    try {
      setLoading(true);

      const payload = {
        title: title.trim(),
        originalPrompt: originalPrompt.trim(),
        slug: normalizeSlug(slug || title),
        sourceImageUrl,
        sourceBlobPathname: sourceBlobPathname || undefined,
        sourceContentType: sourceContentType || undefined,
        sourceImageSize: sourceImageSize || undefined,
        category: category.trim() || "Uncategorized",
        tags: tagsInput
          .split(",")
          .map((t) => t.trim().toLowerCase().replace(/^#/, ""))
          .filter(Boolean),
        cameraModel: cameraModel.trim() || undefined,
        lens: lens.trim() || undefined,
        focalLength: focalLength.trim() || undefined,
        aperture: aperture.trim() || undefined,
        shutterSpeed: shutterSpeed.trim() || undefined,
        iso: iso.trim() || undefined,
        lightingSetup: lightingSetup.trim() || undefined,
        renderingEngine: renderingEngine.trim() || undefined,
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
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 1. Core Prompt Details (Required) */}
      <div className="p-6 rounded-xl bg-[#111317] border border-[#21252e] space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>1. Core Prompt Details (Required)</span>
          </h2>
          <span className="text-[11px] font-mono text-amber-500/80 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
            Canonical Asset
          </span>
        </div>

        {/* Title */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            Prompt Title *
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="e.g. The Candid Walk & Laugh — Hand-in-Hand"
            className="w-full px-3.5 py-2.5 bg-[#14171f] border border-[#222834] rounded-lg text-xs text-white placeholder-slate-500 focus:border-amber-500 transition-colors"
          />
        </div>

        {/* Source Image Upload */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-amber-500" />
              <span>Source Image *</span>
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setImageInputMode("upload")}
                className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${
                  imageInputMode === "upload"
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                    : "border-transparent text-slate-500 hover:text-slate-300"
                }`}
              >
                Upload File
              </button>
              <button
                type="button"
                onClick={() => setImageInputMode("url")}
                className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${
                  imageInputMode === "url"
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                    : "border-transparent text-slate-500 hover:text-slate-300"
                }`}
              >
                External URL
              </button>
            </div>
          </div>

          {imageInputMode === "upload" ? (
            <div>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                className="hidden"
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="p-6 border-2 border-dashed border-[#262c38] hover:border-amber-500/50 rounded-xl bg-[#0e1014] cursor-pointer text-center transition-colors group"
              >
                <Upload className="w-8 h-8 text-slate-500 group-hover:text-amber-400 mx-auto mb-2 transition-colors" />
                <p className="text-xs font-medium text-slate-200">
                  {uploadingImage ? "Uploading to Vercel Blob..." : "Click to upload source image (JPEG, PNG, WEBP)"}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Validated with binary magic bytes &bull; Up to 10MB &bull; Stored in Vercel Blob
                </p>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="url"
                placeholder="https://images.unsplash.com/photo-..."
                value={directUrlInput}
                onChange={(e) => setDirectUrlInput(e.target.value)}
                className="flex-1 px-3.5 py-2.5 bg-[#14171f] border border-[#222834] rounded-lg text-xs text-white placeholder-slate-500 focus:border-amber-500"
              />
              <button
                type="button"
                onClick={handleApplyDirectUrl}
                className="px-4 py-2.5 bg-[#1b1f2b] hover:bg-[#252a3a] text-slate-200 text-xs font-medium rounded-lg border border-[#272d3c]"
              >
                Attach URL
              </button>
            </div>
          )}

          {/* Image Preview Banner */}
          {imagePreviewUrl && (
            <div className="mt-3 p-3 rounded-lg bg-[#0c0d12] border border-[#1f242e] flex items-center gap-4">
              <div className="w-16 h-16 rounded-lg bg-[#141720] border border-[#262c38] overflow-hidden shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagePreviewUrl}
                  alt="Source image preview"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0 text-xs space-y-1">
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-white font-medium">Source Image Ready in Vercel Blob</span>
                </div>
                <p className="text-[11px] text-slate-500 font-mono truncate">
                  {sourceImageUrl || imagePreviewUrl}
                </p>
                {sourceImageSize && (
                  <span className="text-[10px] text-slate-400 font-mono">
                    {(sourceImageSize / 1024).toFixed(1)} KB &bull; {sourceContentType || "image/jpeg"}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Public Slug */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-slate-300">
              Public Page Slug *
            </label>
            <button
              type="button"
              onClick={handleRegenerateSlug}
              className="text-[11px] text-amber-500 hover:text-amber-400 flex items-center gap-1 font-mono"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Regenerate from Title</span>
            </button>
          </div>
          <div className="flex items-center">
            <span className="px-3 py-2.5 bg-[#1b1f2a] border border-r-0 border-[#222834] rounded-l-lg text-xs text-slate-500 font-mono">
              /p/
            </span>
            <input
              type="text"
              required
              value={slug}
              onChange={(e) => {
                setSlug(normalizeSlug(e.target.value));
                setIsSlugLocked(true);
              }}
              placeholder="the-candid-walk-laugh-hand-in-hand"
              className="w-full px-3.5 py-2.5 bg-[#14171f] border border-[#222834] rounded-r-lg text-xs text-amber-400 font-mono placeholder-slate-500 focus:border-amber-500 transition-colors"
            />
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Permanent public URL for follower landing page. Collision-safe &bull; Preserved across title edits unless regenerated.
          </p>
        </div>

        {/* Original Photography Prompt */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-slate-300">
              Original Photography Prompt *
            </label>
            <span className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
              <Check className="w-3 h-3" />
              <span>Saved Verbatim &bull; Immutable</span>
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
      </div>

      {/* 2. Optional Collapsible Photography Metadata */}
      <div className="rounded-xl bg-[#111317] border border-[#21252e] overflow-hidden">
        <button
          type="button"
          onClick={() => setShowMetadata(!showMetadata)}
          className="w-full p-5 flex items-center justify-between hover:bg-[#141720] transition-colors text-left"
        >
          <div className="flex items-center gap-2.5">
            <Camera className="w-4 h-4 text-amber-500" />
            <div>
              <span className="text-xs font-semibold text-white block">
                Camera & Technical Metadata (Optional)
              </span>
              <span className="text-[11px] text-slate-500 block">
                Many prompts are pure natural language. All fields below may remain empty.
              </span>
            </div>
          </div>
          {showMetadata ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>

        {showMetadata && (
          <div className="p-6 pt-2 border-t border-[#1d222d] space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3.5 py-2 bg-[#14171f] border border-[#222834] rounded-lg text-xs text-white focus:border-amber-500"
                >
                  <option value="Uncategorized">Uncategorized</option>
                  {PHOTOGRAPHY_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="bridal, tuscan, golden-hour, 85mm"
                  className="w-full px-3.5 py-2 bg-[#14171f] border border-[#222834] rounded-lg text-xs text-white placeholder-slate-500 focus:border-amber-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Camera Model
                </label>
                <input
                  type="text"
                  value={cameraModel}
                  onChange={(e) => setCameraModel(e.target.value)}
                  placeholder="e.g. Canon EOS R5 / Leica M11"
                  className="w-full px-3.5 py-2 bg-[#14171f] border border-[#222834] rounded-lg text-xs text-white placeholder-slate-500 focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Lens
                </label>
                <input
                  type="text"
                  value={lens}
                  onChange={(e) => setLens(e.target.value)}
                  placeholder="e.g. RF 85mm f/1.2L"
                  className="w-full px-3.5 py-2 bg-[#14171f] border border-[#222834] rounded-lg text-xs text-white placeholder-slate-500 focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Focal Length
                </label>
                <input
                  type="text"
                  value={focalLength}
                  onChange={(e) => setFocalLength(e.target.value)}
                  placeholder="e.g. 85mm"
                  className="w-full px-3.5 py-2 bg-[#14171f] border border-[#222834] rounded-lg text-xs text-white placeholder-slate-500 focus:border-amber-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Aperture
                </label>
                <input
                  type="text"
                  value={aperture}
                  onChange={(e) => setAperture(e.target.value)}
                  placeholder="e.g. f/1.4"
                  className="w-full px-3.5 py-2 bg-[#14171f] border border-[#222834] rounded-lg text-xs text-white placeholder-slate-500 focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Shutter Speed
                </label>
                <input
                  type="text"
                  value={shutterSpeed}
                  onChange={(e) => setShutterSpeed(e.target.value)}
                  placeholder="e.g. 1/800s"
                  className="w-full px-3.5 py-2 bg-[#14171f] border border-[#222834] rounded-lg text-xs text-white placeholder-slate-500 focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  ISO
                </label>
                <input
                  type="text"
                  value={iso}
                  onChange={(e) => setIso(e.target.value)}
                  placeholder="e.g. 100"
                  className="w-full px-3.5 py-2 bg-[#14171f] border border-[#222834] rounded-lg text-xs text-white placeholder-slate-500 focus:border-amber-500"
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
                  value={lightingSetup}
                  onChange={(e) => setLightingSetup(e.target.value)}
                  placeholder="e.g. Warm rim backlight + soft golden hour bounce"
                  className="w-full px-3.5 py-2 bg-[#14171f] border border-[#222834] rounded-lg text-xs text-white placeholder-slate-500 focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Rendering / AI Diffusion Engine
                </label>
                <input
                  type="text"
                  value={renderingEngine}
                  onChange={(e) => setRenderingEngine(e.target.value)}
                  placeholder="e.g. Midjourney v6.1 / Flux.1 Dev"
                  className="w-full px-3.5 py-2 bg-[#14171f] border border-[#222834] rounded-lg text-xs text-white placeholder-slate-500 focus:border-amber-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-2">
        <Link
          href="/prompts"
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-[#242936] text-xs text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Cancel</span>
        </Link>

        <button
          type="submit"
          disabled={loading || uploadingImage}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold transition-all hover:scale-[1.02] disabled:opacity-50"
        >
          <Save className="w-4 h-4 stroke-[2.5]" />
          <span>
            {loading ? "Saving Prompt..." : uploadingImage ? "Uploading Image..." : isEditing ? "Save Changes" : "Save Prompt"}
          </span>
        </button>
      </div>
    </form>
  );
}
