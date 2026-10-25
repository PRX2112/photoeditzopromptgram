"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AdminShell } from "@/components/layout/AdminShell";
import {
  Sparkles,
  Send,
  Calendar,
  Save,
  Check,
  AlertCircle,
  Eye,
  Camera,
  ImageIcon,
  Clock,
  ExternalLink,
  RefreshCw,
  Copy,
  ChevronRight,
  Layers,
  Wand2,
} from "lucide-react";
import type { PromptItem } from "@/types";

function ComposerContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const preselectedPromptId = searchParams.get("promptId");

  // Current Step Tracker
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: Available Prompts & Selection
  const [availablePrompts, setAvailablePrompts] = useState<PromptItem[]>([]);
  const [loadingPrompts, setLoadingPrompts] = useState(true);
  const [selectedPromptId, setSelectedPromptId] = useState<string>(preselectedPromptId || "");
  const [selectedPrompt, setSelectedPrompt] = useState<PromptItem | null>(null);
  const [copiedPromptText, setCopiedPromptText] = useState(false);

  // Step 2: Copy Generation (Gemini) & Automation Config
  const [captionStyle, setCaptionStyle] = useState<"editorial" | "storytelling" | "minimalist" | "technical">("editorial");
  const [postTitle, setPostTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [commentKeyword, setCommentKeyword] = useState("STUDIO");
  const [altText, setAltText] = useState("");
  const [suggestedKeywords, setSuggestedKeywords] = useState<string[]>([]);
  const [isGeneratingCopy, setIsGeneratingCopy] = useState(false);
  const [copyGenerationSource, setCopyGenerationSource] = useState<string | null>(null);
  const [isCaptionManuallyEdited, setIsCaptionManuallyEdited] = useState(false);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);

  // Step 3: FFmpeg Image Rendering
  const [isRenderingImage, setIsRenderingImage] = useState(false);
  const [renderedImageUrl, setRenderedImageUrl] = useState<string>("");
  const [renderedBlobPathname, setRenderedBlobPathname] = useState<string>("");
  const [instagramHandle, setInstagramHandle] = useState("@prx_dev");

  // Step 4: Scheduling & Submission
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("18:00");
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Fetch genuinely available prompts on mount
  useEffect(() => {
    setLoadingPrompts(true);
    fetch("/api/prompts?availableOnly=true")
      .then((res) => res.json())
      .then((data) => {
        if (data.data) {
          setAvailablePrompts(data.data);

          if (preselectedPromptId) {
            const found = data.data.find((p: PromptItem) => p.id === preselectedPromptId);
            if (found) {
              selectPrompt(found);
            }
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoadingPrompts(false));

    // Also fetch connected Instagram account handle
    fetch("/api/instagram/status")
      .then((res) => res.json())
      .then((data) => {
        if (data.data?.account?.username) {
          setInstagramHandle(`@${data.data.account.username}`);
        }
      })
      .catch(() => {});
  }, [preselectedPromptId]);

  const selectPrompt = (prompt: PromptItem) => {
    setSelectedPrompt(prompt);
    setSelectedPromptId(prompt.id);
    setPostTitle(prompt.title);

    // Initial keyword based on category or title
    const kw = prompt.category && prompt.category !== "Uncategorized"
      ? prompt.category.split(" ")[0].toUpperCase()
      : "STUDIO";
    setCommentKeyword(kw);
  };

  const handleCopyPromptText = () => {
    if (!selectedPrompt) return;
    navigator.clipboard.writeText(selectedPrompt.originalPrompt);
    setCopiedPromptText(true);
    setTimeout(() => setCopiedPromptText(false), 2000);
  };

  // Step 2: Gemini Copy Generation
  const handleGenerateCopy = async (force: boolean = false) => {
    if (!selectedPrompt) {
      setStatusMessage({ type: "error", text: "Please select a prompt in Step 1 first." });
      return;
    }

    if (isCaptionManuallyEdited && !force) {
      setShowRegenerateConfirm(true);
      return;
    }

    setShowRegenerateConfirm(false);

    try {
      setIsGeneratingCopy(true);
      setStatusMessage(null);

      const res = await fetch("/api/gemini/generate-caption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalPrompt: selectedPrompt.originalPrompt,
          category: selectedPrompt.category,
          imageTitle: postTitle || selectedPrompt.title,
          commentKeyword: commentKeyword.toUpperCase(),
          captionStyle,
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || "Gemini caption generation failed");
      }

      const generated = json.data;
      setPostTitle(generated.title || postTitle || selectedPrompt.title);
      setCaption(generated.caption);
      const tagString = Array.isArray(generated.hashtags)
        ? generated.hashtags.slice(0, 5).join(" ")
        : (generated.hashtags || "");
      setHashtags(tagString);
      setSuggestedKeywords(generated.suggestedKeywords || []);
      setAltText(generated.altText || "");
      setCopyGenerationSource(json.source);
      setIsCaptionManuallyEdited(false);

      setStatusMessage({
        type: "success",
        text: "CTA-first Instagram caption and hashtags generated successfully!",
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Generation failed";
      const isAuth = msg.toLowerCase().includes("unauthorized") || msg.includes("401");
      setStatusMessage({
        type: "error",
        text: isAuth
          ? "Authentication required. Please sign in at /login to generate captions with Gemini AI."
          : `Gemini service notice: ${msg}. You can manually write or edit the caption below.`,
      });
    } finally {
      setIsGeneratingCopy(false);
    }
  };

  // Step 3: FFmpeg Image Rendering
  const handleRenderFFmpegImage = async () => {
    const sourceUrl = selectedPrompt?.sourceImageUrl;
    if (!sourceUrl) {
      setStatusMessage({
        type: "error",
        text: "Selected prompt does not have a source image in Vercel Blob. Please upload a source image for this prompt in the Prompt Library.",
      });
      return;
    }

    try {
      setIsRenderingImage(true);
      setStatusMessage(null);

      const res = await fetch("/api/posts/render-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceImageUrl: sourceUrl,
          title: postTitle || selectedPrompt.title,
          instagramHandle,
          commentKeyword: (commentKeyword || "STUDIO").toUpperCase().trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || "FFmpeg image rendering failed");
      }

      setRenderedImageUrl(json.data.renderedBlobUrl);
      setRenderedBlobPathname(json.data.renderedBlobPathname);
      setStatusMessage({
        type: "success",
        text: "Finished Instagram image rendered with FFmpeg (1080x1350, 4:5 vertical portrait)!",
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Rendering failed";
      setStatusMessage({
        type: "error",
        text: `FFmpeg rendering issue: ${msg}`,
      });
    } finally {
      setIsRenderingImage(false);
    }
  };

  // Step 4: Submission Action (DRAFT, SCHEDULED, PUBLISHED)
  const handleSubmitPost = async (action: "DRAFT" | "PUBLISHED" | "SCHEDULED") => {
    if (!selectedPromptId) {
      setStatusMessage({ type: "error", text: "Please select an available prompt in Step 1." });
      return;
    }
    if (!caption.trim()) {
      setStatusMessage({ type: "error", text: "Please write or generate an Instagram caption in Step 2." });
      return;
    }
    if (action === "SCHEDULED" && !scheduleDate) {
      setStatusMessage({ type: "error", text: "Please select a valid future date to schedule this post." });
      return;
    }

    const finalImageToPublish = renderedImageUrl || selectedPrompt?.sourceImageUrl;
    if (action === "PUBLISHED" && !finalImageToPublish) {
      setStatusMessage({
        type: "error",
        text: "A valid image asset is required to publish. Please render an image in Step 3.",
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
        caption: caption.trim(),
        hashtags: hashtags ? hashtags.trim() : "",
        commentKeyword: commentKeyword.toUpperCase().trim(),
        mediaType: "IMAGE",
        renderedImageUrl: renderedImageUrl || undefined,
        renderedBlobPathname: renderedBlobPathname || undefined,
        blobUrl: finalImageToPublish || undefined,
        blobPathname: renderedBlobPathname || selectedPrompt?.sourceBlobPathname || undefined,
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

      const msg =
        action === "PUBLISHED"
          ? "Published to Instagram successfully! Temporary Blob assets will be purged."
          : action === "SCHEDULED"
          ? "Scheduled for future publication! Viewable in calendar."
          : "Saved post as draft successfully!";

      setStatusMessage({ type: "success", text: msg });

      setTimeout(() => {
        router.push("/calendar");
      }, 1400);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Submission error";
      setStatusMessage({ type: "error", text: msg });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Status Alert Banner */}
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
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        </div>
      )}

      {/* Guided 4-Step Progress Navigation */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { num: 1, label: "Select Prompt", icon: Layers },
          { num: 2, label: "Generate Copy", icon: Wand2 },
          { num: 3, label: "FFmpeg Image", icon: Camera },
          { num: 4, label: "Review & Publish", icon: Send },
        ].map((step) => {
          const StepIcon = step.icon;
          const isActive = currentStep === step.num;
          const isDone = currentStep > step.num;

          return (
            <button
              key={step.num}
              type="button"
              onClick={() => setCurrentStep(step.num as any)}
              className={`p-3.5 rounded-xl border text-left transition-all flex items-center gap-3 ${
                isActive
                  ? "bg-amber-500/10 border-amber-500/40 text-amber-400 shadow-lg"
                  : isDone
                  ? "bg-[#11141c] border-[#222838] text-slate-300 hover:border-slate-700"
                  : "bg-[#0d0f14] border-[#1d222e] text-slate-500 hover:text-slate-400"
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono text-xs font-bold shrink-0 ${
                  isActive
                    ? "bg-amber-500 text-black"
                    : isDone
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "bg-[#181c26] text-slate-500"
                }`}
              >
                {isDone ? <Check className="w-3.5 h-3.5" /> : step.num}
              </div>
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-mono block opacity-60">Step {step.num}</span>
                <span className="text-xs font-semibold block truncate">{step.label}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* STEP 1: Select a Prompt */}
      {currentStep === 1 && (
        <div className="p-6 rounded-2xl bg-[#111317] border border-[#21252e] space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-amber-500" />
                <span>Step 1 — Select an Available Photography Prompt</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Only unposted prompts with available source images are shown. Assigned drafts or published prompts are excluded.
              </p>
            </div>
            <Link
              href="/prompts/new"
              className="text-xs px-3 py-1.5 rounded-lg border border-[#252b39] bg-[#141720] text-amber-400 hover:text-amber-300"
            >
              + Create New Prompt
            </Link>
          </div>

          {loadingPrompts ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2].map((n) => (
                <div key={n} className="h-44 rounded-xl bg-[#0e1014] border border-[#1f242e] animate-pulse" />
              ))}
            </div>
          ) : availablePrompts.length === 0 ? (
            <div className="text-center py-12 bg-[#0c0d12] rounded-xl border border-[#1f242e] p-6 space-y-3">
              <Sparkles className="w-8 h-8 text-slate-600 mx-auto" />
              <h3 className="text-sm font-semibold text-white">No Unposted Prompts Available</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                All prompts in your library are either published, scheduled, or currently assigned to active drafts.
              </p>
              <Link
                href="/prompts/new"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 text-black text-xs font-semibold"
              >
                Create a New Prompt
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {availablePrompts.map((p) => {
                const isSelected = selectedPromptId === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => selectPrompt(p)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all flex gap-4 ${
                      isSelected
                        ? "bg-amber-500/10 border-amber-500 shadow-md ring-1 ring-amber-500/50"
                        : "bg-[#0e1014] border-[#1f242e] hover:border-slate-700"
                    }`}
                  >
                    {/* Source Image Preview */}
                    <div className="w-20 h-24 rounded-lg bg-[#141720] border border-[#242a38] overflow-hidden shrink-0 relative">
                      {p.sourceImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.sourceImageUrl}
                          alt={p.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-600">
                          <ImageIcon className="w-6 h-6" />
                        </div>
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                            {p.category}
                          </span>
                          {isSelected && (
                            <span className="text-[11px] font-semibold text-amber-400 flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" />
                              <span>Selected</span>
                            </span>
                          )}
                        </div>
                        <h4 className="text-xs font-semibold text-white truncate">{p.title}</h4>
                        <p className="text-[11px] text-slate-400 font-mono line-clamp-2 mt-1">
                          {p.originalPrompt}
                        </p>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500 truncate mt-2">
                        /p/{p.slug}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Canonical Read-Only Display */}
          {selectedPrompt && (
            <div className="p-5 rounded-xl bg-[#0a0c10] border border-[#1f242e] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Canonical Original Prompt (Read-Only &bull; Never Modified)</span>
                </span>
                <button
                  type="button"
                  onClick={handleCopyPromptText}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#161922] border border-[#252a36]"
                >
                  {copiedPromptText ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedPromptText ? "Copied!" : "Copy Verbatim Prompt"}</span>
                </button>
              </div>
              <div className="p-3.5 rounded-lg bg-[#07080a] border border-[#181b22] text-xs font-mono text-slate-300 leading-relaxed select-all">
                {selectedPrompt.originalPrompt}
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="button"
              disabled={!selectedPrompt}
              onClick={() => setCurrentStep(2)}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold disabled:opacity-50 transition-all hover:scale-[1.01]"
            >
              <span>Next: Generate Instagram Copy</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Generate Instagram Copy with Gemini */}
      {currentStep === 2 && (
        <div className="p-6 rounded-2xl bg-[#111317] border border-[#21252e] space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <Wand2 className="w-5 h-5 text-amber-500" />
                <span>Step 2 — Generate Instagram Copy & Automation Trigger</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Generate editorial caption, hashtags, and DM comment keyword. Captions remain completely separate from the original prompt.
              </p>
            </div>
            {copyGenerationSource && (
              <span className="text-[11px] font-mono text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded border border-amber-500/20">
                Engine: {copyGenerationSource}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Editorial Caption Tone
              </label>
              <select
                value={captionStyle}
                onChange={(e) => setCaptionStyle(e.target.value as any)}
                className="w-full px-3.5 py-2.5 bg-[#14171f] border border-[#222834] rounded-lg text-xs text-white focus:border-amber-500 cursor-pointer"
              >
                <option value="editorial">Editorial & High Fashion</option>
                <option value="storytelling">Cinematic Storytelling</option>
                <option value="minimalist">Minimalist & Poetic</option>
                <option value="technical">Technical Lighting & Camera</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Comment Trigger Keyword *
              </label>
              <input
                type="text"
                value={commentKeyword}
                onChange={(e) => setCommentKeyword(e.target.value.toUpperCase())}
                placeholder="e.g. STUDIO"
                className="w-full px-3.5 py-2.5 bg-[#14171f] border border-[#222834] rounded-lg text-xs text-amber-400 font-mono uppercase font-bold focus:border-amber-500"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleGenerateCopy()}
            disabled={isGeneratingCopy || !selectedPrompt}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black text-xs font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {isGeneratingCopy ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Generating Copy with Google Gemini...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Generate Instagram Caption & Hashtags with Gemini AI</span>
              </>
            )}
          </button>

          {suggestedKeywords.length > 0 && (
            <div>
              <span className="text-[11px] text-slate-400 block mb-1">Suggested Keywords:</span>
              <div className="flex flex-wrap gap-1.5">
                {suggestedKeywords.map((kw) => (
                  <button
                    key={kw}
                    type="button"
                    onClick={() => setCommentKeyword(kw.toUpperCase())}
                    className="px-2.5 py-1 rounded bg-[#171b24] hover:bg-[#202532] text-amber-400 border border-[#242a38] text-[10px] font-mono font-medium"
                  >
                    +{kw}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Prominent CTA Preview Banner */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-[#161a24] to-[#12141a] border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-xl">👇</span>
              <div className="min-w-0">
                <span className="text-[10px] uppercase tracking-wider font-bold text-amber-400 block font-mono">
                  Prominent Comment-to-DM CTA Preview
                </span>
                <p className="text-xs font-mono font-medium text-white truncate">
                  Comment <span className="text-amber-400 font-bold bg-amber-400/20 px-1.5 py-0.5 rounded">{commentKeyword || "KEYWORD"}</span> to get the full photography prompt in your DMs!
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {commentKeyword && caption.toUpperCase().includes(commentKeyword.toUpperCase()) ? (
                <span className="px-2.5 py-1 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1 font-semibold">
                  <Check className="w-3.5 h-3.5" />
                  <span>Keyword Active in Caption</span>
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded text-[10px] font-mono bg-amber-500/10 text-amber-300 border border-amber-500/20 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                  <span>Keyword Missing in Text</span>
                </span>
              )}
            </div>
          </div>

          {/* Overwrite Confirmation Banner */}
          {showRegenerateConfirm && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-200">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span>You have modified the caption. Regenerating will overwrite your custom edits.</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => handleGenerateCopy(true)}
                  className="px-3 py-1 rounded bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs"
                >
                  Confirm Overwrite
                </button>
                <button
                  type="button"
                  onClick={() => setShowRegenerateConfirm(false)}
                  className="px-2.5 py-1 rounded bg-[#181c25] hover:bg-[#202532] text-slate-300 text-xs"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Editable Caption with Live Stats & Keyword Badge */}
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-200">
                  Instagram Caption (Editable) *
                </label>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  KEYWORD: {commentKeyword}
                </span>
                {isCaptionManuallyEdited && (
                  <span className="text-[10px] font-mono text-slate-400 italic">
                    (User edited)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`text-[11px] font-mono ${
                    caption.trim().split(/\s+/).filter(Boolean).length >= 40 &&
                    caption.trim().split(/\s+/).filter(Boolean).length <= 70
                      ? "text-emerald-400 font-semibold"
                      : "text-slate-400"
                  }`}
                >
                  {caption.length} chars &bull; {caption.trim() ? caption.trim().split(/\s+/).filter(Boolean).length : 0} words (Target: 40–70)
                </span>
                <button
                  type="button"
                  onClick={() => handleGenerateCopy(false)}
                  disabled={isGeneratingCopy || !selectedPrompt}
                  className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#161a24] hover:bg-[#1d2230] border border-[#2b3345] transition-colors disabled:opacity-50"
                  title="Regenerate caption with fresh copy"
                >
                  <RefreshCw className={`w-3 h-3 ${isGeneratingCopy ? "animate-spin" : ""}`} />
                  <span>Regenerate Caption</span>
                </button>
              </div>
            </div>

            <textarea
              rows={6}
              value={caption}
              onChange={(e) => {
                setCaption(e.target.value);
                setIsCaptionManuallyEdited(true);
              }}
              placeholder="1. Short hook&#10;&#10;2. 👇 Comment KEYWORD to get the full photography prompt in your DMs!&#10;&#10;3. Save this for your next creative shoot. ❤️"
              className="w-full px-3.5 py-2.5 bg-[#14171f] border border-[#222834] rounded-lg text-xs text-slate-200 leading-relaxed placeholder-slate-500 focus:border-amber-500 font-sans"
            />
          </div>

          {/* Editable Hashtags */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-200">
                Hashtags (Editable &bull; Max 5)
              </label>
              <span
                className={`text-[11px] font-mono ${
                  hashtags.trim().split(/\s+/).filter(Boolean).length <= 5
                    ? "text-slate-400"
                    : "text-rose-400 font-semibold"
                }`}
              >
                {hashtags.trim() ? hashtags.trim().split(/\s+/).filter(Boolean).length : 0} / 5 hashtags
              </span>
            </div>
            <input
              type="text"
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
              placeholder="#PhotographyPrompts #PortraitInspo #CreativeLighting ..."
              className="w-full px-3.5 py-2.5 bg-[#14171f] border border-[#222834] rounded-lg text-xs text-blue-400 font-mono focus:border-amber-500"
            />
          </div>

          {/* Automation Review Reminder Banner */}
          <div className="p-3.5 rounded-xl bg-[#0a0d14] border border-[#1d2432] flex items-center gap-3 text-xs text-slate-300">
            <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>
              <strong className="text-white">Review Reminder:</strong> Check that the comment keyword (<span className="text-amber-400 font-mono font-bold">{commentKeyword}</span>) matches your automation settings in Settings &rarr; Comment-to-DM before publishing.
            </span>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="text-xs text-slate-400 hover:text-white"
            >
              &larr; Back to Prompt Selection
            </button>
            <button
              type="button"
              disabled={!caption.trim()}
              onClick={() => setCurrentStep(3)}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold disabled:opacity-50 transition-all hover:scale-[1.01]"
            >
              <span>Next: Render Finished FFmpeg Image</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Create Finished Instagram Image with FFmpeg */}
      {currentStep === 3 && (
        <div className="p-6 rounded-2xl bg-[#111317] border border-[#21252e] space-y-6">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Camera className="w-5 h-5 text-amber-500" />
              <span>Step 3 — Render Finished Instagram Image (FFmpeg)</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Renders a 1080 × 1350 (4:5) Instagram-ready vertical format. Fits the photo safely with zero distortion, blurred background padding, top title bar, and bottom handle branding.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Title to Render on Top
              </label>
              <input
                type="text"
                value={postTitle}
                onChange={(e) => setPostTitle(e.target.value)}
                placeholder="Title to print on header..."
                className="w-full px-3.5 py-2.5 bg-[#14171f] border border-[#222834] rounded-lg text-xs text-white focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Dynamic Comment Keyword for CTA Strip
              </label>
              <input
                type="text"
                value={commentKeyword}
                onChange={(e) => setCommentKeyword(e.target.value.toUpperCase())}
                placeholder="e.g. BRIDAL"
                className="w-full px-3.5 py-2.5 bg-[#14171f] border border-[#222834] rounded-lg text-xs text-amber-400 font-mono font-bold uppercase focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Instagram Handle on Bottom
              </label>
              <input
                type="text"
                value={instagramHandle}
                onChange={(e) => setInstagramHandle(e.target.value)}
                placeholder="@prx_dev"
                className="w-full px-3.5 py-2.5 bg-[#14171f] border border-[#222834] rounded-lg text-xs text-amber-400 font-mono font-bold focus:border-amber-500"
              />
            </div>
          </div>

          {/* Action-Explaining Dynamic CTA Strip Preview Banner */}
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-500/10 via-[#161a24] to-[#12141a] border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="text-lg">🖼️</span>
              <div>
                <span className="text-[10px] uppercase tracking-wider font-bold text-amber-400 block font-mono">
                  Action-Explaining Dynamic Image CTA Strip
                </span>
                <p className="text-xs font-mono font-medium text-white">
                  Image will display: <span className="text-amber-400 font-bold bg-amber-400/20 px-1.5 py-0.5 rounded">COMMENT &quot;{commentKeyword.toUpperCase() || "STUDIO"}&quot;</span> near bottom of photo, just above handle.
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold whitespace-nowrap">
              Action Visible Before Expand
            </span>
          </div>

          {/* Render Action Button */}
          <button
            type="button"
            onClick={handleRenderFFmpegImage}
            disabled={isRenderingImage || !selectedPrompt?.sourceImageUrl}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black text-xs font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {isRenderingImage ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Composing 1080x1350 Image with FFmpeg...</span>
              </>
            ) : (
              <>
                <Camera className="w-4 h-4" />
                <span>{renderedImageUrl ? "Re-Render Image with FFmpeg" : "Render Finished Instagram Image with FFmpeg"}</span>
              </>
            )}
          </button>

          {/* Preview Comparison Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* Original Source Image */}
            <div className="space-y-2">
              <span className="text-xs font-medium text-slate-400 block">Original Source Photo (from Prompt)</span>
              <div className="aspect-[4/5] bg-[#0c0d12] rounded-xl border border-[#1f242e] overflow-hidden flex items-center justify-center relative">
                {selectedPrompt?.sourceImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selectedPrompt.sourceImageUrl}
                    alt="Original source"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <span className="text-xs text-slate-600">No source image</span>
                )}
              </div>
            </div>

            {/* Finished Rendered Image */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-amber-400 block">
                  Finished 4:5 Instagram Image (Rendered)
                </span>
                {renderedImageUrl && (
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    1080 × 1350 Ready
                  </span>
                )}
              </div>
              <div className="aspect-[4/5] bg-[#0c0d12] rounded-xl border border-[#1f242e] overflow-hidden flex items-center justify-center relative">
                {renderedImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={renderedImageUrl}
                    alt="Rendered Instagram Output"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-center p-6 text-slate-600">
                    <Camera className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">Click render above to generate the finished Instagram image</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="text-xs text-slate-400 hover:text-white"
            >
              &larr; Back to Copy Generation
            </button>
            <button
              type="button"
              onClick={() => setCurrentStep(4)}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold transition-all hover:scale-[1.01]"
            >
              <span>Next: Review & Choose Publishing Action</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Review and Choose Publishing Action */}
      {currentStep === 4 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Review Details (Left) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="p-6 rounded-2xl bg-[#111317] border border-[#21252e] space-y-4">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <Send className="w-5 h-5 text-amber-500" />
                <span>Step 4 — Final Review & Account Destination</span>
              </h2>

              <div className="p-4 rounded-xl bg-[#0a0c10] border border-[#1f242e] space-y-3 text-xs">
                <div className="flex justify-between items-center border-b border-[#1b1f28] pb-2">
                  <span className="text-slate-400">Target Instagram Account:</span>
                  <span className="font-mono text-amber-400 font-bold">{instagramHandle}</span>
                </div>
                <div className="flex justify-between items-center border-b border-[#1b1f28] pb-2">
                  <span className="text-slate-400">Comment Trigger Keyword:</span>
                  <span className="font-mono text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded">
                    {commentKeyword}
                  </span>
                </div>
                <div className="flex justify-between items-center border-b border-[#1b1f28] pb-2">
                  <span className="text-slate-400">Associated Public Link:</span>
                  <span className="font-mono text-slate-300">/p/{selectedPrompt?.slug}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-400 block">Caption & Call to Action:</span>
                  <p className="text-slate-200 leading-relaxed whitespace-pre-line text-[11px] bg-[#12141c] p-3 rounded-lg border border-[#1f242e]">
                    {caption}
                  </p>
                </div>
                {hashtags && (
                  <p className="text-blue-400 text-[11px] font-mono leading-relaxed">{hashtags}</p>
                )}

                {/* Automation Review Reminder */}
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-200">
                  <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block text-amber-300">Automation Settings Reminder:</span>
                    <span className="text-slate-300">
                      Check that the comment keyword (<strong className="font-mono text-amber-300 font-bold bg-amber-400/20 px-1 py-0.5 rounded">{commentKeyword}</strong>) matches your active automation settings before publishing.
                    </span>
                  </div>
                </div>
              </div>

              {/* Scheduling Options */}
              <div className="p-4 rounded-xl bg-[#14171f] border border-[#222834] space-y-3">
                <label className="text-xs font-medium text-slate-200 cursor-pointer flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isScheduling}
                    onChange={(e) => setIsScheduling(e.target.checked)}
                    className="rounded text-amber-500 focus:ring-0 bg-slate-900 border-slate-700 w-3.5 h-3.5"
                  />
                  <span>Schedule for Future Publication</span>
                </label>

                {isScheduling && (
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#1e2330]">
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

              {/* Three Distinct Publishing Actions */}
              <div className="space-y-2.5 pt-2">
                {isScheduling ? (
                  <button
                    type="button"
                    disabled={submitting || !scheduleDate}
                    onClick={() => handleSubmitPost("SCHEDULED")}
                    className="w-full py-3 rounded-xl bg-purple-500 hover:bg-purple-400 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all hover:scale-[1.01] disabled:opacity-50"
                  >
                    <Calendar className="w-4 h-4" />
                    <span>{submitting ? "Scheduling Post..." : "2. Schedule Post into Background Queue"}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleSubmitPost("PUBLISHED")}
                    className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold flex items-center justify-center gap-2 transition-all hover:scale-[1.01] disabled:opacity-50"
                  >
                    <Send className="w-4 h-4 stroke-[2.5]" />
                    <span>{submitting ? "Publishing to Instagram..." : "3. Publish to Instagram Now"}</span>
                  </button>
                )}

                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleSubmitPost("DRAFT")}
                  className="w-full py-2.5 rounded-xl bg-[#181c25] hover:bg-[#202532] text-slate-300 text-xs font-medium flex items-center justify-center gap-2 border border-[#262c3a] transition-colors"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>1. Save as Draft (Editable Later)</span>
                </button>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  &larr; Back to FFmpeg Image Preview
                </button>
              </div>
            </div>
          </div>

          {/* Instagram Mockup (Right) */}
          <div className="lg:col-span-5 sticky top-20">
            <div className="rounded-2xl bg-black border border-[#242834] overflow-hidden shadow-2xl text-xs max-w-sm mx-auto">
              {/* Header */}
              <div className="p-3 border-b border-[#1f232d] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-500 to-rose-500 p-[1.5px]">
                    <div className="w-full h-full rounded-full bg-black flex items-center justify-center text-[10px] font-bold text-white">
                      PH
                    </div>
                  </div>
                  <div>
                    <p className="font-semibold text-white leading-tight">{instagramHandle.replace("@", "")}</p>
                    <p className="text-[10px] text-slate-400">Original Audio</p>
                  </div>
                </div>
                <span className="text-slate-500 font-bold">&bull;&bull;&bull;</span>
              </div>

              {/* Photo Area */}
              <div className="aspect-[4/5] bg-[#12141a] flex items-center justify-center relative overflow-hidden">
                {renderedImageUrl || selectedPrompt?.sourceImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={renderedImageUrl || selectedPrompt?.sourceImageUrl || ""}
                    alt="Mockup preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-center p-6 text-slate-600">
                    <Camera className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-[11px]">Select a prompt to preview</p>
                  </div>
                )}
              </div>

              {/* Action Bar */}
              <div className="p-3 pb-1 flex items-center justify-between text-white">
                <div className="flex items-center gap-3">
                  <span>❤️</span>
                  <span>💬</span>
                  <span>🚀</span>
                </div>
                <span>🔖</span>
              </div>

              {/* Caption */}
              <div className="p-3 pt-1 space-y-1 text-slate-200">
                <p className="text-[11px] whitespace-pre-line leading-relaxed">
                  <span className="font-semibold text-white mr-1.5">{instagramHandle.replace("@", "")}</span>
                  {caption || "Caption preview..."}
                </p>
                {hashtags && (
                  <p className="text-[11px] text-blue-400 font-normal leading-relaxed">{hashtags}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ComposerPage() {
  return (
    <AdminShell
      title="Create Instagram Post"
      subtitle="Select an available prompt, generate Gemini copy, compose 1080x1350 FFmpeg imagery, and publish"
    >
      <Suspense fallback={<div className="text-slate-400 p-8">Loading post composer...</div>}>
        <ComposerContent />
      </Suspense>
    </AdminShell>
  );
}
