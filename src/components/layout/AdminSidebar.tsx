"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Sparkles,
  Send,
  Calendar,
  Inbox,
  Settings,
  ExternalLink,
  Camera,
  LogOut,
  Radio,
} from "lucide-react";

interface AdminSidebarProps {
  onCloseMobile?: () => void;
}

export function AdminSidebar({ onCloseMobile }: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/prompts", label: "Prompt Library", icon: Sparkles },
    { href: "/composer", label: "Create Post", icon: Send },
    { href: "/calendar", label: "Publishing Calendar", icon: Calendar },
    { href: "/automation", label: "Automation Inbox", icon: Inbox },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch {
      router.push("/login");
    }
  };

  return (
    <aside className="w-64 bg-[#0d0f13] border-r border-[#21252e] flex flex-col h-full min-h-screen text-slate-300">
      {/* Brand Header */}
      <div className="p-5 border-b border-[#21252e] flex items-center justify-between">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 group"
          onClick={onCloseMobile}
        >
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 group-hover:scale-105 transition-transform">
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <span className="font-semibold text-white tracking-tight text-sm block">
              PromptGram Hub
            </span>
            <span className="text-[11px] text-amber-500/80 font-mono tracking-wider uppercase">
              Curator Studio
            </span>
          </div>
        </Link>
      </div>

      {/* Meta Connection Badge */}
      <div className="mx-4 mt-4 p-2.5 rounded-lg bg-[#14171e] border border-[#232732] flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <Radio className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
          <span className="text-slate-400 font-medium">Meta Automation</span>
        </div>
        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          Ready
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="text-[10px] uppercase font-mono tracking-wider text-slate-500 px-3 py-1 font-semibold">
          Editorial & Studio
        </div>
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onCloseMobile}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold"
                  : "text-slate-400 hover:text-white hover:bg-[#161a22]"
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "text-amber-400" : "text-slate-400"}`} />
              {item.label}
            </Link>
          );
        })}

        <div className="pt-4 text-[10px] uppercase font-mono tracking-wider text-slate-500 px-3 py-1 font-semibold">
          Public Experience
        </div>
        <Link
          href="/p/golden-hour-tuscan-vineyard-bridal-portrait"
          target="_blank"
          className="flex items-center justify-between px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-[#161a22] transition-colors"
        >
          <div className="flex items-center gap-3">
            <ExternalLink className="w-4 h-4 text-slate-500" />
            <span>Public Prompt Page</span>
          </div>
          <span className="text-[10px] bg-[#1e232e] text-slate-400 px-1.5 py-0.5 rounded">Preview</span>
        </Link>
      </nav>

      {/* User Footer */}
      <div className="p-4 border-t border-[#21252e] bg-[#0a0c0f]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-semibold text-slate-200">
              PD
            </div>
            <div className="truncate">
              <p className="text-xs font-medium text-slate-200 truncate">Photo Director</p>
              <p className="text-[11px] text-slate-500 font-mono truncate">Administrator</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Log out"
            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
