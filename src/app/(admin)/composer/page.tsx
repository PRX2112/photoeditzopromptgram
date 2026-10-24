"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AdminShell } from "@/components/layout/AdminShell";
import {
  Upload,
  Sparkles,
  Send,
  Calendar,
  Save,
  Check,
  AlertCircle,
  Eye,
  Camera,
  Image as ImageIcon,
  Clock,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import type { PromptItem } from "@/types";

function ComposerContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const preselectedPromptId = searchParams.get("promptId");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Prompts state
  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [selectedPromptId, setSelectedPromptId] = useState<string>(preselectedPromptId || "");
  const [selectedPrompt, setSelectedPrompt] = useState<PromptItem | null>(null);

  // Image state
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string>("");
  const [uploadedBlobUrl, setUploadedBlobUrl] = useState<string>("");
  const [uploadedBlobPathname, setUploadedBlobPathname] = useState<string>("");
  const [uploadedAssetKey, setUploadedAssetKey] = useState<string>("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageInputMethod, setImageInputMethod] = useState<"file" | "url">("file");
  const [directImageUrl, setDirectImageUrl] = useState("");

  // Post & AI state
  const [commentKeyword, setCommentKeyword] = useState("BRIDAL");
  const [captionStyle, setCaptionStyle] = useState<"editorial" | "storytelling" | "minimalist" | "technical">("editorial");
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [altText, setAltText] = useState("");
  const [suggestedKeywords, setSuggestedKeywords] = useState<string[]>([]);

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationSource, setGenerationSource] = useState<string | null>(null);

  // Scheduling state
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("18:00");
  const [isScheduling, setIsScheduling] = useState(false);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Preview tab
  const [activePreviewTab, setActivePreviewTab] = useState<"instagram" | "promptPage">("instagram");

  // Fetch prompts on mount
  useEffect(() => {
    fetch("/api/prompts")
      .then((res) => res.json())
      .then((data) => {
        if (data.data) {
          setPrompts(data.data);
          if (preselectedPromptId) {
            const found = data.data.find((p: PromptItem) => p.id === preselectedPromptId);
            if (found) {
              setSelectedPrompt(found);
              setSelectedPromptId(found.id);
              // Set initial keyword suggestion based on category
              const kw = found.category.split(" ")[0].toUpperCase();
              setCommentKeyword(kw);
            }
          }
        }
      })
      .catch(() => {});
  }, [preselectedPromptId]);

  // When selected prompt changes
  const handlePromptSelect = (id: string) => {
    setSelectedPromptId(id);
    const found = prompts.find((p) => p.id === id);
    if (found) {
      setSelectedPrompt(found);
      const kw = found.category.split(" ")[0].toUpperCase();
      setCommentKeyword(kw);
      setTitle(found.title);
    }
  };

  // Handle local image file selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Browser preview immediately
    const localUrl = URL.createObjectURL(file);
    setImagePreviewUrl(localUrl);

    // Ephemeral serverless upload
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
        throw new Error(json.error || "Image upload failed");
      }

      const publicUrl = json.publicUrl || json.blobUrl || "";
      setUploadedBlobUrl(publicUrl);
      setUploadedBlobPathname(json.pathname || "");
      setUploadedAssetKey(json.pathname || "");
      setImagePreviewUrl(publicUrl);
      setStatusMessage({ type: "success", text: "Image uploaded and stored in Vercel Blob successfully!" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload error";
      setStatusMessage({ type: "error", text: msg });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleDirectUrlApply = () => {
    if (directImageUrl && (directImageUrl.startsWith("https://") || directImageUrl.startsWith("http://"))) {
      setImagePreviewUrl(directImageUrl);
      setUploadedBlobUrl(directImageUrl);
      setUploadedBlobPathname("");
      setUploadedAssetKey("");
    }
  };

  // Trigger Gemini AI generation
  const handleGenerateWithGemini = async () => {
    if (!selectedPrompt) {
      setStatusMessage({ type: "error", text: "Please select a prompt from your library first." });
      return;
    }

    try {
      setIsGenerating(true);
      setStatusMessage(null);

      const res = await fetch("/api/gemini/generate-caption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalPrompt: selectedPrompt.originalPrompt,
          category: selectedPrompt.category,
          imageTitle: title || selectedPrompt.title,
          commentKeyword: commentKeyword.toUpperCase(),
          captionStyle,
        }),
      });

      const json = await res.json();

      if (!res.ok || json.error) {
        throw new Error(json.error || "Gemini generation failed");
      }

      const generated = json.data;
      setTitle(generated.title);
      setCaption(generated.caption);
      setHashtags(generated.hashtags.join(" "));
      setSuggestedKeywords(generated.suggestedKeywords || []);
      setAltText(generated.altText || "");
      setGenerationSource(json.source);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Generation failed";
      setStatusMessage({ type: "error", text: msg });
    } finally {
      setIsGenerating(false);
    }
  };

  // Submit Post: DRAFT, PUBLISH NOW, or SCHEDULE
  const handleSubmitPost = async (action: "DRAFT" | "PUBLISHED" | "SCHEDULED") => {
    if (!selectedPromptId) {
      setStatusMessage({ type: "error", text: "Please select a prompt first." });
      return;
    }
    if (!caption.trim()) {
      setStatusMessage({ type: "error", text: "Caption cannot be empty." });
      return;
    }
    if (action === "SCHEDULED" && !scheduleDate) {
      setStatusMessage({ type: "error", text: "Please choose a date to schedule this post." });
      return;
    }

    if (uploadingImage) {
      setStatusMessage({
        type: "error",
        text: "Image is currently uploading to cloud storage. Please wait until upload finishes before publishing.",
      });
      return;
    }

    const targetImageUrl = uploadedBlobUrl || (imagePreviewUrl && !imagePreviewUrl.startsWith("blob:") ? imagePreviewUrl : "");

    if (action === "PUBLISHED" && !targetImageUrl) {
      setStatusMessage({
        type: "error",
        text: "A valid public image is required to publish to Instagram. Please upload an image or provide a public URL.",
      });
      return;
    }

    try {
      setSubmitting(true);
      setStatusMessage(null);

      let scheduledDateTimeIso: string | null = null;
      if (action === "SCHEDULED") {
        const fullDateStr = `${scheduleDate}T${scheduleTime || "12:00"}:00`;
        scheduledDateTimeIso = new Date(fullDateStr).toISOString();
      }

      const payload = {
        promptId: selectedPromptId,
        caption,
        hashtags: hashtags || "",
        commentKeyword: commentKeyword.toUpperCase(),
        mediaType: "IMAGE",
        blobUrl: targetImageUrl || undefined,
        blobPathname: uploadedBlobPathname || undefined,
        temporaryImageUrl: targetImageUrl || undefined,
        temporaryAssetKey: uploadedBlobPathname || undefined,
        status: action,
        scheduledFor: scheduledDateTimeIso || undefined,
      };

      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok || json.error) {
        throw new Error(json.error || "Failed to process post");
      }

      const actionText =
        action === "PUBLISHED"
          ? "Published to Instagram successfully!"
          : action === "SCHEDULED"
          ? "Scheduled into background queue!"
          : "Saved as draft!";

      setStatusMessage({ type: "success", text: actionText });

      setTimeout(() => {
        router.push("/calendar");
      }, 1200);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Submission error";
      setStatusMessage({ type: "error", text: msg });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {statusMessage && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center justify-between ${
            statusMessage.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : "bg-rose-500/10 border-rose-500/30 text-rose-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === "success" ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: Composer Controls */}
        <div className="lg:col-span-7 space-y-6">
          {/* 1. Image Upload & Ephemeral Storage */}
          <div className="p-6 rounded-xl bg-[#111317] border border-[#21252e] space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-amber-500" />
                <span>1. Select & Preview Image</span>
              </h2>
              <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                Ephemeral Storage Policy Active
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <button
                type="button"
                onClick={() => setImageInputMethod("file")}
                className={`px-3 py-1.5 rounded-lg border transition-colors ${
                  imageInputMethod === "file"
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-400 font-medium"
                    : "border-[#21252f] bg-[#141720] text-slate-400"
                }`}
              >
                Local Image Upload
              </button>
              <button
                type="button"
                onClick={() => setImageInputMethod("url")}
                className={`px-3 py-1.5 rounded-lg border transition-colors ${
                  imageInputMethod === "url"
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-400 font-medium"
                    : "border-[#21252f] bg-[#141720] text-slate-400"
                }`}
              >
                Public HTTPS URL
              </button>
            </div>

            {imageInputMethod === "file" ? (
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
                    {uploadingImage ? "Uploading ephemeral asset..." : "Click or drag image to preview"}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Temporary object storage with automatic TTL. Never permanently stored in PostgreSQL.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/photo-..."
                  value={directImageUrl}
                  onChange={(e) => setDirectImageUrl(e.target.value)}
                  className="flex-1 px-3.5 py-2 bg-[#14171f] border border-[#222834] rounded-lg text-xs text-white placeholder-slate-500 focus:border-amber-500"
                />
                <button
                  type="button"
                  onClick={handleDirectUrlApply}
                  className="px-4 py-2 bg-[#1b1f2b] hover:bg-[#252a3a] text-slate-200 text-xs font-medium rounded-lg border border-[#272d3c]"
                >
                  Load URL
                </button>
              </div>
            )}
          </div>

          {/* 2. Prompt Association */}
          <div className="p-6 rounded-xl bg-[#111317] border border-[#21252e] space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>2. Associate Photography Prompt</span>
              </h2>
              <span className="text-[11px] text-slate-400">
                Original prompt will not be modified
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Select from Prompt Library
              </label>
              <select
                value={selectedPromptId}
                onChange={(e) => handlePromptSelect(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#14171f] border border-[#222834] rounded-lg text-xs text-white focus:border-amber-500 cursor-pointer"
              >
                <option value="">-- Choose a Photography Prompt --</option>
                {prompts.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.category}] {p.title}
                  </option>
                ))}
              </select>
            </div>

            {selectedPrompt && (
              <div className="p-3.5 rounded-lg bg-[#0e1014] border border-[#1f242e] text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono text-amber-400">
                    Category: {selectedPrompt.category}
                  </span>
                  <a
                    href={`/p/${selectedPrompt.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 font-mono"
                  >
                    <span>/p/{selectedPrompt.slug}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <p className="text-slate-300 font-mono text-[11px] line-clamp-3 leading-relaxed">
                  {selectedPrompt.originalPrompt}
                </p>
              </div>
            )}
          </div>

          {/* 3. Gemini Caption Generator */}
          <div className="p-6 rounded-xl bg-[#111317] border border-[#21252e] space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>3. Gemini AI Caption & Automation Settings</span>
              </h2>
              {generationSource && (
                <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  {generationSource === "gemini-live" ? "Gemini 2.5 Flash" : "Photographic Engine"}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Comment Keyword (Trigger) *
                </label>
                <input
                  type="text"
                  value={commentKeyword}
                  onChange={(e) => setCommentKeyword(e.target.value.toUpperCase())}
                  placeholder="e.g. BRIDAL"
                  className="w-full px-3.5 py-2.5 bg-[#14171f] border border-[#222834] rounded-lg text-xs text-amber-400 font-mono uppercase font-bold focus:border-amber-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Followers who comment this keyword receive the prompt link in DM.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Editorial Caption Tone
                </label>
                <select
                  value={captionStyle}
                  onChange={(e) =>
                    setCaptionStyle(e.target.value as "editorial" | "storytelling" | "minimalist" | "technical")
                  }
                  className="w-full px-3.5 py-2.5 bg-[#14171f] border border-[#222834] rounded-lg text-xs text-white focus:border-amber-500 cursor-pointer"
                >
                  <option value="editorial">Editorial & High Fashion</option>
                  <option value="storytelling">Cinematic Storytelling</option>
                  <option value="minimalist">Minimalist & Poetic</option>
                  <option value="technical">Technical Lighting & Camera</option>
                </select>
              </div>
            </div>

            {suggestedKeywords.length > 0 && (
              <div>
                <span className="text-[11px] text-slate-400 block mb-1">
                  Suggested Alternative Keywords:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {suggestedKeywords.map((kw) => (
                    <button
                      key={kw}
                      type="button"
                      onClick={() => setCommentKeyword(kw.toUpperCase())}
                      className="px-2.5 py-1 rounded bg-[#171b24] hover:bg-[#202532] text-amber-400 border border-[#242a38] text-[10px] font-mono font-medium transition-colors"
                    >
                      +{kw}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Generate Button */}
            <button
              type="button"
              onClick={handleGenerateWithGemini}
              disabled={isGenerating || !selectedPrompt}
              className="w-full py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black text-xs font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Generating Editorial Copy with Gemini...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate Title, Caption & Hashtags</span>
                </>
              )}
            </button>

            {/* Editable Generated Title */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Post Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Evocative title..."
                className="w-full px-3.5 py-2.5 bg-[#14171f] border border-[#222834] rounded-lg text-xs text-white placeholder-slate-500 focus:border-amber-500"
              />
            </div>

            {/* Editable Generated Caption */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Instagram Caption *
              </label>
              <textarea
                rows={6}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Post caption including call to action..."
                className="w-full px-3.5 py-2.5 bg-[#14171f] border border-[#222834] rounded-lg text-xs text-slate-200 leading-relaxed placeholder-slate-500 focus:border-amber-500"
              />
            </div>

            {/* Editable Hashtags */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Hashtags
              </label>
              <input
                type="text"
                value={hashtags}
                onChange={(e) => setHashtags(e.target.value)}
                placeholder="#weddingphotography #bridalportrait ..."
                className="w-full px-3.5 py-2.5 bg-[#14171f] border border-[#222834] rounded-lg text-xs text-slate-300 placeholder-slate-500 focus:border-amber-500"
              />
            </div>

            {/* Alt Text */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Accessible Image Alt Text
              </label>
              <input
                type="text"
                value={altText}
                onChange={(e) => setAltText(e.target.value)}
                placeholder="Descriptive alt text for screen readers..."
                className="w-full px-3.5 py-2.5 bg-[#14171f] border border-[#222834] rounded-lg text-xs text-slate-300 placeholder-slate-500 focus:border-amber-500"
              />
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Live Previews & Publishing Workflow */}
        <div className="lg:col-span-5 space-y-6 sticky top-20">
          {/* Preview Tabs Header */}
          <div className="p-1 rounded-xl bg-[#111317] border border-[#21252e] flex items-center text-xs">
            <button
              type="button"
              onClick={() => setActivePreviewTab("instagram")}
              className={`flex-1 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-1.5 ${
                activePreviewTab === "instagram"
                  ? "bg-[#181c25] text-amber-400 border border-[#262c3a]"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Instagram Mockup</span>
            </button>
            <button
              type="button"
              onClick={() => setActivePreviewTab("promptPage")}
              className={`flex-1 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-1.5 ${
                activePreviewTab === "promptPage"
                  ? "bg-[#181c25] text-amber-400 border border-[#262c3a]"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>DM Prompt Link</span>
            </button>
          </div>

          {/* Instagram Post Mockup Preview */}
          {activePreviewTab === "instagram" ? (
            <div className="rounded-xl bg-[#000000] border border-[#242834] overflow-hidden shadow-2xl text-xs max-w-sm mx-auto">
              {/* Instagram Header */}
              <div className="p-3 border-b border-[#1f232d] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-500 to-rose-500 p-[1.5px]">
                    <div className="w-full h-full rounded-full bg-black flex items-center justify-center text-[10px] font-bold text-white">
                      PH
                    </div>
                  </div>
                  <div>
                    <p className="font-semibold text-white leading-tight">photographerprompts</p>
                    <p className="text-[10px] text-slate-400">Original Audio</p>
                  </div>
                </div>
                <span className="text-slate-500 font-bold">&bull;&bull;&bull;</span>
              </div>

              {/* Photo Area */}
              <div className="aspect-[4/5] bg-[#12141a] flex items-center justify-center relative overflow-hidden">
                {imagePreviewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imagePreviewUrl}
                    alt={altText || "Post preview"}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-center p-6 text-slate-600">
                    <Camera className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-[11px]">Upload an image to see Instagram preview</p>
                  </div>
                )}
              </div>

              {/* Action Bar */}
              <div className="p-3 pb-1 flex items-center justify-between text-white">
                <div className="flex items-center gap-3">
                  <span className="text-sm">❤️</span>
                  <span className="text-sm">💬</span>
                  <span className="text-sm">🚀</span>
                </div>
                <span className="text-sm">🔖</span>
              </div>

              {/* Caption & Keyword CTA */}
              <div className="p-3 pt-1 space-y-1 text-slate-200">
                <p className="text-[11px] whitespace-pre-line leading-relaxed">
                  <span className="font-semibold text-white mr-1.5">photographerprompts</span>
                  {caption || "Your generated caption and call to action will appear here..."}
                </p>
                {hashtags && (
                  <p className="text-[11px] text-blue-400 font-normal leading-relaxed">{hashtags}</p>
                )}
                <div className="pt-2 border-t border-[#1a1d26] text-[10px] text-slate-500 flex items-center justify-between">
                  <span>View all 24 comments</span>
                  <span>2 hours ago</span>
                </div>
              </div>
            </div>
          ) : (
            /* Public Prompt Page Preview Card */
            <div className="p-5 rounded-xl bg-[#111317] border border-[#21252e] space-y-3">
              <span className="text-[10px] uppercase font-mono tracking-wider text-amber-500 font-bold block">
                Follower DM Landing Destination
              </span>
              <div className="p-3 rounded-lg bg-[#141720] border border-[#212632] space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-xs text-white font-semibold">
                    {title || selectedPrompt?.title || "Bridal Portrait Prompt"}
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-mono text-[11px] line-clamp-4">
                  {selectedPrompt?.originalPrompt || "Prompt text..."}
                </p>
                <div className="pt-2 flex items-center justify-between text-[11px] text-slate-500 border-t border-[#1d222d]">
                  <span>Slug: /p/{selectedPrompt?.slug || "sample-slug"}</span>
                  <span className="text-amber-400 font-mono">One-click Copy</span>
                </div>
              </div>
            </div>
          )}

          {/* Action & Publishing Box */}
          <div className="p-6 rounded-xl bg-[#111317] border border-[#21252e] space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              <span>Publication Actions</span>
            </h3>

            {/* Schedule Toggle */}
            <div className="p-3 rounded-lg bg-[#14171f] border border-[#222834] space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-200 cursor-pointer flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isScheduling}
                    onChange={(e) => setIsScheduling(e.target.checked)}
                    className="rounded text-amber-500 focus:ring-0 bg-slate-900 border-slate-700 w-3.5 h-3.5"
                  />
                  <span>Schedule for Future Publication</span>
                </label>
                <span className="text-[10px] text-slate-500 font-mono">Vercel Cron Queue</span>
              </div>

              {isScheduling && (
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#1e2330]">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Date</label>
                    <input
                      type="date"
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-[#0e1014] border border-[#222834] rounded text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Time</label>
                    <input
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-[#0e1014] border border-[#222834] rounded text-xs text-white"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-2">
              {isScheduling ? (
                <button
                  type="button"
                  disabled={submitting || uploadingImage || !scheduleDate}
                  onClick={() => handleSubmitPost("SCHEDULED")}
                  className="w-full py-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-black text-xs font-semibold flex items-center justify-center gap-2 transition-all hover:scale-[1.01] disabled:opacity-50"
                >
                  <Calendar className="w-4 h-4" />
                  <span>{uploadingImage ? "Uploading Image to Storage..." : submitting ? "Scheduling..." : "Schedule Publication"}</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={submitting || uploadingImage}
                  onClick={() => handleSubmitPost("PUBLISHED")}
                  className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold flex items-center justify-center gap-2 transition-all hover:scale-[1.01] disabled:opacity-50"
                >
                  <Send className="w-4 h-4 stroke-[2.5]" />
                  <span>{uploadingImage ? "Uploading Image to Storage..." : submitting ? "Publishing to Instagram..." : "Publish to Instagram Now"}</span>
                </button>
              )}

              <button
                type="button"
                disabled={submitting || uploadingImage}
                onClick={() => handleSubmitPost("DRAFT")}
                className="w-full py-2 rounded-lg bg-[#181c25] hover:bg-[#202532] text-slate-300 text-xs font-medium flex items-center justify-center gap-2 border border-[#262c3a] transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save as Draft</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ComposerPage() {
  return (
    <AdminShell
      title="Create Instagram Post"
      subtitle="Assemble visual content, generate Gemini captions, and configure comment keywords"
    >
      <Suspense fallback={<div className="text-slate-400 p-8">Loading post composer...</div>}>
        <ComposerContent />
      </Suspense>
    </AdminShell>
  );
}
