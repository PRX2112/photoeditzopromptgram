"use client";

import Link from "next/link";
import { Plus, Menu, Clock, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

interface AdminHeaderProps {
  title: string;
  subtitle?: string;
  onOpenMobileMenu?: () => void;
}

export function AdminHeader({ title, subtitle, onOpenMobileMenu }: AdminHeaderProps) {
  const [timeInfo, setTimeInfo] = useState<{ local: string; timezone: string }>({
    local: "",
    timezone: "",
  });

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const formatted = new Intl.DateTimeFormat("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }).format(now);
      setTimeInfo({ local: formatted, timezone: tz });
    };

    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-16 bg-[#0c0e12]/90 backdrop-blur-md border-b border-[#21252e] px-4 md:px-8 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="md:hidden p-2 text-slate-400 hover:text-white hover:bg-[#161a22] rounded-lg transition-colors"
          aria-label="Toggle Navigation"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-base md:text-lg font-semibold text-white tracking-tight flex items-center gap-2">
            {title}
          </h1>
          {subtitle && <p className="text-xs text-slate-400 hidden sm:block">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Explicit Timezone Indicator */}
        <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#14171f] border border-[#232834] text-xs text-slate-400 font-mono">
          <Clock className="w-3.5 h-3.5 text-amber-500/80" />
          <span>{timeInfo.local || "00:00"}</span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-300">{timeInfo.timezone || "UTC"}</span>
        </div>

        {/* Quick Actions */}
        <Link
          href="/prompts/new"
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#2b303c] bg-[#14171f] hover:bg-[#1b202a] text-slate-200 text-xs font-medium transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>New Prompt</span>
        </Link>

        <Link
          href="/composer"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold shadow-sm transition-all hover:scale-[1.02]"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Create Post</span>
        </Link>
      </div>
    </header>
  );
}
