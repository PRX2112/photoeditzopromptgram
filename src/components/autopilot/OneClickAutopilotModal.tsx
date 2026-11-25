"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Zap,
  Camera,
  Layers,
  Send,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { AUTOPILOT_THEMES } from "@/types/autopilot";

interface OneClickAutopilotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function OneClickAutopilotModal({ isOpen, onClose, onSuccess }: OneClickAutopilotModalProps) {
  const router = useRouter();
  const [selectedTheme, setSelectedTheme] = useState("random");
  const [commentKeyword, setCommentKeyword] = useState("");
  const [autoPublish, setAutoPublish] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [completedResult, setCompletedResult] = useState<{
    promptId: string;
    title: string;
    slug: string;
    renderedUrl: string;
    instagramPermalink?: string;
  } | null>(null);

  if (!isOpen) return null;

  const handleStartAutopilot = async () => {
    try {
      setIsGenerating(true);
      setError(null);
      setCompletedResult(null);

      // Visual step progression
      setCurrentStep(1); // Writing prompt
      const stepTimer1 = setTimeout(() => setCurrentStep(2), 2200); // Imagen 3
      const stepTimer2 = setTimeout(() => setCurrentStep(3), 5000); // FFmpeg
      const stepTimer3 = setTimeout(() => setCurrentStep(4), 7500); // Social Copy

      const res = await fetch("/api/autopilot/generate-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theme: selectedTheme,
          commentKeyword: commentKeyword ? commentKeyword.toUpperCase().trim() : undefined,
          autoPublish,
        }),
      });

      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      clearTimeout(stepTimer3);

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || "Autopilot generation failed");
      }

      const { prompt, post } = json.data;
      setCompletedResult({
        promptId: prompt.id,
        title: prompt.title,
        slug: prompt.slug,
        renderedUrl: post.renderedImageUrl,
        instagramPermalink: post.instagramPermalink,
      });

      if (onSuccess) onSuccess();

      // If in preview mode, seamlessly forward to Composer after a brief success celebration
      if (!autoPublish) {
        setTimeout(() => {
          router.push(`/composer?promptId=${prompt.id}`);
          onClose();
        }, 1800);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Generation failed";
      setError(msg);
      setCurrentStep(0);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#0f1218] border border-[#232936] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-[#1f2430] bg-[#141720] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center text-black shadow-lg shadow-amber-500/20">
              <Zap className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>1-Click AI Studio Autopilot</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                  GEMINI + IMAGEN 3
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Generates a photography prompt, creates the photorealistic image, renders the 4:5 vertical frame, and writes social copy.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-[#1f2430] transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-200 text-xs">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {completedResult ? (
            /* Success State Banner */
            <div className="p-6 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Post Generated Successfully!</h3>
                <p className="text-xs text-emerald-300/80 mt-1 font-mono">
                  &ldquo;{completedResult.title}&rdquo;
                </p>
              </div>

              {completedResult.instagramPermalink ? (
                <div className="pt-2">
                  <a
                    href={completedResult.instagramPermalink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500 text-black font-bold text-xs hover:bg-emerald-400 transition-colors"
                  >
                    <span>View Published Post on Instagram</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              ) : (
                <p className="text-[11px] text-slate-400">
                  Redirecting to Composer to review and publish...
                </p>
              )}
            </div>
          ) : isGenerating ? (
            /* Generating Progress Animation */
            <div className="py-8 px-4 text-center space-y-6">
              <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-2 border-amber-500/20 animate-ping" />
                <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <RefreshCw className="w-7 h-7 animate-spin" />
                </div>
              </div>

              <div className="space-y-1.5">
                <h3 className="text-sm font-bold text-white">
                  {currentStep === 1 && "1/4 Inventing Photography Concept with Gemini..."}
                  {currentStep === 2 && "2/4 Generating Photorealistic Image with Imagen 3..."}
                  {currentStep === 3 && "3/4 Composing 4:5 Asset & CTA Strip with FFmpeg..."}
                  {currentStep >= 4 && "4/4 Crafting CTA-First Instagram Copy & Finalizing..."}
                </h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Running the complete automated studio pipeline. This takes approximately 10–15 seconds.
                </p>
              </div>

              {/* Progress Steps Indicator */}
              <div className="grid grid-cols-4 gap-2 pt-2 max-w-lg mx-auto">
                {[
                  { label: "1. Prompt", active: currentStep >= 1 },
                  { label: "2. Photo", active: currentStep >= 2 },
                  { label: "3. FFmpeg", active: currentStep >= 3 },
                  { label: "4. Social", active: currentStep >= 4 },
                ].map((s, idx) => (
                  <div
                    key={idx}
                    className={`py-1.5 px-2 rounded-lg border text-[10px] font-mono text-center transition-all ${
                      s.active
                        ? "bg-amber-500/20 border-amber-500/40 text-amber-300 font-bold"
                        : "bg-[#141720] border-[#222834] text-slate-600"
                    }`}
                  >
                    {s.label}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Configuration Form */
            <div className="space-y-5">
              {/* Theme Selection */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-200">
                  Choose Aesthetic Direction / Theme:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {AUTOPILOT_THEMES.map((theme) => {
                    const isSelected = selectedTheme === theme.id;
                    return (
                      <button
                        key={theme.id}
                        type="button"
                        onClick={() => setSelectedTheme(theme.id)}
                        className={`p-2.5 rounded-xl border text-left transition-all flex items-center justify-between ${
                          isSelected
                            ? "bg-amber-500/15 border-amber-500/50 text-amber-300 font-semibold"
                            : "bg-[#141720] border-[#222834] text-slate-400 hover:text-white hover:border-[#2d3545]"
                        }`}
                      >
                        <span className="truncate">{theme.label}</span>
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Optional Custom Keyword */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-200 mb-1">
                    Custom Comment Keyword (Optional):
                  </label>
                  <input
                    type="text"
                    value={commentKeyword}
                    onChange={(e) => setCommentKeyword(e.target.value.toUpperCase())}
                    placeholder="Auto-chosen (e.g. BRIDAL, STUDIO)"
                    className="w-full px-3.5 py-2.5 bg-[#141720] border border-[#222834] rounded-lg text-xs text-amber-400 font-mono font-bold uppercase focus:border-amber-500"
                  />
                  <span className="text-[10px] text-slate-500 block mt-1 font-mono">
                    Leave blank to let AI pick the best keyword for this photo.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-200 mb-1">
                    Execution Mode:
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 p-2 rounded-lg bg-[#141720] border border-[#222834] cursor-pointer hover:border-slate-600 transition-colors">
                      <input
                        type="radio"
                        name="autoPublish"
                        checked={!autoPublish}
                        onChange={() => setAutoPublish(false)}
                        className="text-amber-500 focus:ring-amber-500"
                      />
                      <div>
                        <span className="font-semibold text-white block text-xs">
                          Preview in Composer (Recommended)
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          Review generated image and copy before publishing.
                        </span>
                      </div>
                    </label>

                    <label className="flex items-center gap-2 p-2 rounded-lg bg-[#141720] border border-[#222834] cursor-pointer hover:border-slate-600 transition-colors">
                      <input
                        type="radio"
                        name="autoPublish"
                        checked={autoPublish}
                        onChange={() => setAutoPublish(true)}
                        className="text-amber-500 focus:ring-amber-500"
                      />
                      <div>
                        <span className="font-semibold text-amber-400 block text-xs">
                          Publish Immediately to Instagram
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          100% hands-free direct publication to @prx_dev.
                        </span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        {!completedResult && (
          <div className="p-4 border-t border-[#1f2430] bg-[#12141a] flex items-center justify-between">
            <span className="text-[11px] text-slate-500 font-mono">
              Ready to generate full prompt, image, and 4:5 asset
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isGenerating}
                className="px-4 py-2 rounded-lg bg-[#1a1e27] hover:bg-[#222733] text-slate-300 font-medium text-xs transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStartAutopilot}
                disabled={isGenerating}
                className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.02] disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Generating Pipeline...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 fill-current" />
                    <span>Generate Complete Post (1-Click)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
