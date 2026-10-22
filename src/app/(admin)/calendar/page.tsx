"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/layout/AdminShell";
import {
  Calendar,
  Send,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  ExternalLink,
  Plus,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { PostItem } from "@/types";

export default function CalendarPage() {
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("ALL");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/posts");
      const json = await res.json();
      if (json.data) {
        setPosts(json.data);
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handlePublishNow = async (id: string) => {
    try {
      setActionLoadingId(id);
      setStatusMessage(null);
      const res = await fetch(`/api/posts/${id}/publish`, { method: "POST" });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || "Publication failed");
      }
      setStatusMessage({ type: "success", text: `Published to Instagram successfully! (Media ID: ${json.data?.instagramMediaId})` });
      fetchPosts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Publication error";
      setStatusMessage({ type: "error", text: msg });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCancelScheduled = async (id: string) => {
    try {
      setActionLoadingId(id);
      await fetch(`/api/posts`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "DRAFT" }),
      });
      fetchPosts();
    } catch {
      // handle error
    } finally {
      setActionLoadingId(null);
    }
  };

  const filteredPosts = posts.filter((p) => {
    if (filter === "ALL") return true;
    return p.status === filter;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PUBLISHED":
        return (
          <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>PUBLISHED</span>
          </span>
        );
      case "SCHEDULED":
        return (
          <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>SCHEDULED</span>
          </span>
        );
      case "FAILED":
        return (
          <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            <span>FAILED</span>
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20 flex items-center gap-1">
            <FileText className="w-3 h-3" />
            <span>DRAFT</span>
          </span>
        );
    }
  };

  return (
    <AdminShell
      title="Publishing Calendar"
      subtitle="Track scheduled publication queue, live Instagram posts, and drafts"
    >
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
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          </div>
        )}

        {/* Top Filter and Actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 p-1 rounded-lg bg-[#111317] border border-[#21252e] text-xs">
            {["ALL", "SCHEDULED", "PUBLISHED", "DRAFT", "FAILED"].map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                  filter === tab
                    ? "bg-amber-500 text-black font-semibold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchPosts}
              className="p-2 rounded-lg bg-[#14171f] border border-[#232834] text-slate-400 hover:text-white transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <Link
              href="/composer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold transition-all hover:scale-[1.02]"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Create Post</span>
            </Link>
          </div>
        </div>

        {/* Timeline / List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-28 rounded-xl bg-[#111317] border border-[#21252e] animate-pulse"
              />
            ))}
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="text-center py-16 bg-[#101217] rounded-xl border border-[#21252e] p-8">
            <Calendar className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-white">No Posts in this View</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              There are no posts matching the selected &quot;{filter}&quot; filter.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredPosts.map((post) => (
              <div
                key={post.id}
                className="p-5 rounded-xl bg-[#111317] border border-[#21252e] hover:border-[#2f3544] transition-colors flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                {/* Left: Thumbnail & Content */}
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div className="w-16 h-16 rounded-lg bg-[#171b24] border border-[#262c3a] overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {post.temporaryImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={post.temporaryImageUrl}
                        alt="Post media"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Send className="w-5 h-5 text-slate-600" />
                    )}
                  </div>

                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {getStatusBadge(post.status)}
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">
                        KEYWORD: {post.commentKeyword}
                      </span>
                      {post.prompt?.category && (
                        <span className="text-[11px] text-slate-400">
                          {post.prompt.category}
                        </span>
                      )}
                    </div>

                    <p className="text-xs font-medium text-slate-200 line-clamp-2 leading-relaxed">
                      {post.caption}
                    </p>

                    <div className="flex items-center gap-4 text-[11px] text-slate-500 font-mono pt-1">
                      {post.status === "SCHEDULED" && post.scheduledFor && (
                        <span className="flex items-center gap-1 text-sky-400">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Scheduled for: {formatDate(post.scheduledFor)}</span>
                        </span>
                      )}
                      {post.status === "PUBLISHED" && post.publishedAt && (
                        <span className="flex items-center gap-1 text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Published on: {formatDate(post.publishedAt)}</span>
                        </span>
                      )}
                      {post.instagramMediaId && (
                        <span>Media ID: {post.instagramMediaId}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 self-end md:self-center flex-shrink-0">
                  {post.instagramPermalink && (
                    <a
                      href={post.instagramPermalink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#171b24] hover:bg-[#202532] text-slate-300 text-xs font-medium border border-[#252b38] transition-colors"
                    >
                      <span>View on Instagram</span>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                    </a>
                  )}

                  {post.status === "SCHEDULED" && (
                    <>
                      <button
                        onClick={() => handlePublishNow(post.id)}
                        disabled={actionLoadingId === post.id}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold transition-colors disabled:opacity-50"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Publish Now</span>
                      </button>
                      <button
                        onClick={() => handleCancelScheduled(post.id)}
                        disabled={actionLoadingId === post.id}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="Cancel scheduled publication"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </>
                  )}

                  {post.status === "DRAFT" && (
                    <button
                      onClick={() => handlePublishNow(post.id)}
                      disabled={actionLoadingId === post.id}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold transition-colors disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Publish</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
