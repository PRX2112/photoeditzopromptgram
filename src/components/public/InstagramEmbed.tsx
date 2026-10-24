"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Camera, AlertCircle } from "lucide-react";

interface InstagramEmbedProps {
  permalink: string;
  publishedAt?: string | Date | null;
}

export function InstagramEmbed({ permalink, publishedAt }: InstagramEmbedProps) {
  const [embedFailed, setEmbedFailed] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  useEffect(() => {
    if (!permalink) return;

    // Load official Instagram embed script safely
    try {
      const scriptId = "instagram-embed-script";
      let script = document.getElementById(scriptId) as HTMLScriptElement | null;

      if (!script) {
        script = document.createElement("script");
        script.id = scriptId;
        script.src = "https://www.instagram.com/embed.js";
        script.async = true;
        script.onload = () => {
          setScriptLoaded(true);
          // Trigger Instagram parse
          if ((window as any).instgrm) {
            (window as any).instgrm.Embeds.process();
          }
        };
        script.onerror = () => {
          setEmbedFailed(true);
        };
        document.body.appendChild(script);
      } else {
        setScriptLoaded(true);
        if ((window as any).instgrm) {
          (window as any).instgrm.Embeds.process();
        }
      }
    } catch {
      setEmbedFailed(true);
    }
  }, [permalink]);

  if (!permalink) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-white flex items-center gap-2">
          <Camera className="w-4 h-4 text-amber-500" />
          <span>Official Instagram Publication</span>
        </span>
        <a
          href={permalink}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-amber-400 hover:text-amber-300 font-mono flex items-center gap-1.5"
        >
          <span>View on Instagram</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {!embedFailed ? (
        <div className="flex justify-center bg-[#07080a] p-4 rounded-2xl border border-[#1d222e]">
          <blockquote
            className="instagram-media"
            data-instgrm-captioned
            data-instgrm-permalink={permalink}
            data-instgrm-version="14"
            style={{
              background: "#0c0e14",
              border: "1px solid #1f2533",
              borderRadius: "12px",
              boxShadow: "none",
              margin: "1px",
              maxWidth: "540px",
              minWidth: "326px",
              padding: "0",
              width: "calc(100% - 2px)",
            }}
          >
            <div style={{ padding: "16px" }}>
              <a
                href={permalink}
                style={{
                  background: "#12141c",
                  lineHeight: "0",
                  padding: "0 0",
                  textAlign: "center",
                  textDecoration: "none",
                  width: "100%",
                  display: "block",
                  color: "#94a3b8",
                  fontSize: "12px",
                }}
                target="_blank"
                rel="noreferrer"
              >
                View this post on Instagram
              </a>
            </div>
          </blockquote>
        </div>
      ) : (
        /* Fallback when embed script is blocked or fails */
        <div className="p-6 rounded-2xl bg-[#0c0e14] border border-[#1f2533] text-center space-y-3">
          <Camera className="w-8 h-8 text-amber-500 mx-auto" />
          <h4 className="text-sm font-semibold text-white">Instagram Embed Blocked or Unavailable</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Content is live on Instagram. You can view the original published image, comments, and community discussions directly on Instagram.
          </p>
          <div className="pt-2">
            <a
              href={permalink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold transition-all"
            >
              <span>Open on Instagram</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
