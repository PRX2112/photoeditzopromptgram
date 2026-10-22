"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface CopyPromptButtonProps {
  promptText: string;
  slug: string;
}

export function CopyPromptButton({ promptText, slug }: CopyPromptButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(promptText);
      setCopied(true);

      // Track copy count
      fetch(`/api/public/prompts/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "copy" }),
      }).catch(() => {});

      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-xs transition-all ${
        copied
          ? "bg-emerald-500 text-black scale-[1.02]"
          : "bg-amber-500 hover:bg-amber-400 text-black hover:scale-[1.02] shadow-lg shadow-amber-500/10"
      }`}
    >
      {copied ? (
        <>
          <Check className="w-4 h-4 stroke-[2.5]" />
          <span>Copied to Clipboard!</span>
        </>
      ) : (
        <>
          <Copy className="w-4 h-4 stroke-[2.5]" />
          <span>Copy Full Prompt</span>
        </>
      )}
    </button>
  );
}
