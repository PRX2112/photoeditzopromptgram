"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/layout/AdminShell";
import {
  Search,
  Filter,
  Plus,
  ExternalLink,
  Copy,
  Check,
  Edit3,
  Archive,
  Send,
  Sparkles,
  Eye,
  ImageIcon,
} from "lucide-react";
import { PHOTOGRAPHY_CATEGORIES } from "@/lib/utils";
import type { PromptItem } from "@/types";

const STATUS_FILTERS = [
  "all",
  "Available",
  "Draft in progress",
  "Scheduled",
  "Published",
  "Publication failed",
  "Image cleanup pending",
  "Image cleanup failed",
] as const;

export default function PromptsPage() {
  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [showArchived, setShowArchived] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchPrompts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedCategory !== "all") params.append("category", selectedCategory);
      if (selectedStatus !== "all") params.append("status", selectedStatus);
      if (search) params.append("search", search);
      if (showArchived) params.append("includeArchived", "true");

      const res = await fetch(`/api/prompts?${params.toString()}`);
      const json = await res.json();
      if (json.data) {
        setPrompts(json.data);
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrompts();
  }, [selectedCategory, selectedStatus, showArchived]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPrompts();
  };

  const handleCopyPrompt = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDuplicate = async (prompt: PromptItem) => {
    try {
      const res = await fetch("/api/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${prompt.title} (Copy)`,
          originalPrompt: prompt.originalPrompt,
          category: prompt.category,
          tags: prompt.tags,
          sourceImageUrl: prompt.sourceImageUrl || "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80",
          cameraModel: prompt.cameraModel,
          lens: prompt.lens,
          focalLength: prompt.focalLength,
          aperture: prompt.aperture,
          shutterSpeed: prompt.shutterSpeed,
          iso: prompt.iso,
          lightingSetup: prompt.lightingSetup,
          renderingEngine: prompt.renderingEngine,
        }),
      });
      const data = await res.json();
      if (data.data) {
        fetchPrompts();
      }
    } catch {
      // handle error
    }
  };

  const handleArchiveToggle = async (prompt: PromptItem) => {
    try {
      await fetch(`/api/prompts/${prompt.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isArchived: !prompt.isArchived,
        }),
      });
      fetchPrompts();
    } catch {
      // handle error
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "Available":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
            ● Available
          </span>
        );
      case "Draft in progress":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/25">
            ✎ Draft in progress
          </span>
        );
      case "Scheduled":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/25">
            ⏱ Scheduled
          </span>
        );
      case "Published":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/25">
            ✓ Published
          </span>
        );
      case "Publication failed":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/25">
            ✕ Publication failed
          </span>
        );
      case "Image cleanup pending":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-orange-500/10 text-orange-400 border border-orange-500/25">
            ⚡ Image cleanup pending
          </span>
        );
      case "Image cleanup failed":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/10 text-red-400 border border-red-500/25">
            ⚠ Image cleanup failed
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/25">
            {status || "Available"}
          </span>
        );
    }
  };

  return (
    <AdminShell
      title="Prompt Library"
      subtitle="Curate master photography prompts, monitor lifecycle states, and prepare content for Instagram"
    >
      <div className="space-y-6">
        {/* Controls Bar: Search, Category Filter, and Add Button */}
        <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
          <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by title, prompt keywords, tags..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#12141a] border border-[#222733] rounded-lg text-xs text-white placeholder-slate-500 focus:border-amber-500 transition-colors"
            />
          </form>

          <div className="flex flex-wrap items-center gap-3">
            {/* Category Dropdown */}
            <div className="relative">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="pl-8 pr-4 py-2 bg-[#12141a] border border-[#222733] rounded-lg text-xs text-slate-200 appearance-none focus:border-amber-500 transition-colors cursor-pointer"
              >
                <option value="all">All Categories</option>
                {PHOTOGRAPHY_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Status Dropdown */}
            <div className="relative">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="pl-4 pr-4 py-2 bg-[#12141a] border border-[#222733] rounded-lg text-xs text-slate-200 appearance-none focus:border-amber-500 transition-colors cursor-pointer"
              >
                {STATUS_FILTERS.map((st) => (
                  <option key={st} value={st}>
                    {st === "all" ? "All Statuses" : st}
                  </option>
                ))}
              </select>
            </div>

            {/* Archive Toggle */}
            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none px-2.5 py-1.5 rounded-lg border border-[#21252f] bg-[#12141a]">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="rounded text-amber-500 focus:ring-0 bg-slate-900 border-slate-700 w-3.5 h-3.5"
              />
              <span>Show Archived</span>
            </label>

            {/* Create New Prompt Button */}
            <Link
              href="/prompts/new"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold transition-all hover:scale-[1.02]"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>New Prompt</span>
            </Link>
          </div>
        </div>

        {/* Prompts Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="h-64 rounded-xl bg-[#111317] border border-[#21252e] animate-pulse"
              />
            ))}
          </div>
        ) : prompts.length === 0 ? (
          <div className="text-center py-16 bg-[#101217] rounded-xl border border-[#21252e] p-8">
            <Sparkles className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-white">No Prompts Found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              No photography prompts matched your current search and filters.
            </p>
            <div className="mt-4">
              <Link
                href="/prompts/new"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-500 text-black text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create First Prompt</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {prompts.map((prompt) => (
              <div
                key={prompt.id}
                className={`p-5 rounded-xl bg-[#111317] border ${
                  prompt.isArchived ? "border-slate-800 opacity-60" : "border-[#21252e]"
                } hover:border-[#303746] transition-all flex flex-col justify-between`}
              >
                <div>
                  {/* Card Header: Category, Status Badge & View/Copy metrics */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      {getStatusBadge(prompt.status)}
                      {prompt.category && prompt.category !== "Uncategorized" && (
                        <span className="px-2.5 py-0.5 rounded text-[10px] font-medium bg-[#191d27] text-slate-300 border border-[#262c3a]">
                          {prompt.category}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-slate-500 text-[11px] font-mono">
                      <span className="flex items-center gap-1" title="Public views">
                        <Eye className="w-3.5 h-3.5 text-slate-400" />
                        <span>{prompt.viewCount}</span>
                      </span>
                      <span className="flex items-center gap-1" title="Copies">
                        <Copy className="w-3.5 h-3.5 text-slate-400" />
                        <span>{prompt.copyCount}</span>
                      </span>
                    </div>
                  </div>

                  {/* Image Preview & Title Layout */}
                  <div className="flex gap-4 items-start mb-3">
                    {prompt.sourceImageUrl ? (
                      <div className="w-20 h-24 rounded-lg bg-[#0e1014] border border-[#212632] overflow-hidden shrink-0 relative group">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={prompt.sourceImageUrl}
                          alt={prompt.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      </div>
                    ) : (
                      <div className="w-20 h-24 rounded-lg bg-[#0e1014] border border-dashed border-[#212632] flex items-center justify-center shrink-0 text-slate-600">
                        <ImageIcon className="w-6 h-6 opacity-40" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-white leading-snug line-clamp-2 mb-1.5">
                        {prompt.title}
                      </h3>
                      {/* Public URL Slug */}
                      <Link
                        href={`/p/${prompt.slug}`}
                        target="_blank"
                        className="inline-flex items-center gap-1 text-[11px] text-amber-500/80 hover:text-amber-400 font-mono truncate max-w-full"
                        title="View public follower page"
                      >
                        <ExternalLink className="w-3 h-3 shrink-0" />
                        <span className="truncate">/p/{prompt.slug}</span>
                      </Link>
                    </div>
                  </div>

                  {/* Original Prompt Text with Copy Button */}
                  <div className="p-3 rounded-lg bg-[#0c0d11] border border-[#1d212b] text-xs text-slate-300 font-mono relative group mb-3">
                    <p className="line-clamp-3 leading-relaxed">{prompt.originalPrompt}</p>
                    <button
                      onClick={() => handleCopyPrompt(prompt.originalPrompt, prompt.id)}
                      className="absolute top-2 right-2 p-1.5 rounded-md bg-[#181c25] hover:bg-[#222834] text-slate-400 hover:text-white transition-colors"
                      title="Copy full verbatim prompt"
                    >
                      {copiedId === prompt.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  {/* Technical Camera & Lighting Settings (When Present) */}
                  {(prompt.cameraModel || prompt.lens || prompt.lightingSetup || prompt.renderingEngine) && (
                    <div className="flex flex-wrap gap-1.5 mb-3 text-[10px] text-slate-400 font-mono">
                      {prompt.cameraModel && (
                        <span className="px-2 py-0.5 rounded bg-[#171a23] border border-[#252a37]">
                          📷 {prompt.cameraModel}
                        </span>
                      )}
                      {prompt.lens && (
                        <span className="px-2 py-0.5 rounded bg-[#171a23] border border-[#252a37]">
                          🔍 {prompt.lens}
                        </span>
                      )}
                      {prompt.lightingSetup && (
                        <span className="px-2 py-0.5 rounded bg-[#171a23] border border-[#252a37] truncate max-w-[200px]">
                          💡 {prompt.lightingSetup}
                        </span>
                      )}
                      {prompt.renderingEngine && (
                        <span className="px-2 py-0.5 rounded bg-[#171a23] border border-[#252a37]">
                          ⚙ {prompt.renderingEngine}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Tags */}
                  {prompt.tags && prompt.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {prompt.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] text-slate-400 bg-[#161922] px-2 py-0.5 rounded"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Card Actions Footer */}
                <div className="pt-3 border-t border-[#1d212b] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {prompt.latestPost?.instagramPermalink && (
                      <a
                        href={prompt.latestPost.instagramPermalink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1 font-mono"
                      >
                        <span>Instagram Post</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Use in Post (Composer) */}
                    {prompt.status === "Available" ? (
                      <Link
                        href={`/composer?promptId=${prompt.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold transition-all hover:scale-[1.02]"
                        title="Create new Instagram post using this prompt"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Use in Post</span>
                      </Link>
                    ) : (
                      <span className="text-[11px] text-slate-500 font-mono px-2 py-1 bg-[#141720] rounded border border-[#1e2330]">
                        {prompt.status}
                      </span>
                    )}

                    {/* Edit */}
                    <Link
                      href={`/prompts/${prompt.id}/edit`}
                      className="p-1.5 rounded-lg bg-[#181c25] hover:bg-[#232936] text-slate-300 hover:text-white transition-colors"
                      title="Edit prompt details"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </Link>

                    {/* Duplicate */}
                    <button
                      onClick={() => handleDuplicate(prompt)}
                      className="p-1.5 rounded-lg bg-[#181c25] hover:bg-[#232936] text-slate-300 hover:text-white transition-colors"
                      title="Duplicate prompt"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>

                    {/* Archive toggle */}
                    <button
                      onClick={() => handleArchiveToggle(prompt)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        prompt.isArchived
                          ? "bg-amber-500/20 text-amber-400"
                          : "bg-[#181c25] hover:bg-[#232936] text-slate-400 hover:text-white"
                      }`}
                      title={prompt.isArchived ? "Unarchive prompt" : "Archive prompt"}
                    >
                      <Archive className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
