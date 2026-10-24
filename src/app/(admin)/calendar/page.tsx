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
  Trash2,
  RotateCcw,
  Layers,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { PostItem } from "@/types";

export default function CalendarPage() {
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("ALL");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [cleanupActionLoadingId, setCleanupActionLoadingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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

  const handlePublishNow = async (id: string) => {
    try {
      setActionLoadingId(id);
      setStatusMessage(null);
      const res = await fetch(`/api/posts/${id}/publish`, { method: "POST" });
      const json = await res.json();
      if (res.ok && json.success) {
        setStatusMessage({
          type: "success",
          text: `Post published successfully! Media ID: ${json.data?.instagramMediaId || "confirmed"}`,
        });
        await fetchPosts();
      } else {
        setStatusMessage({
          type: "error",
          text: json.error || "Failed to publish post.",
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error publishing post";
      setStatusMessage({ type: "error", text: msg });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRetryCleanup = async (id: string) => {
    try {
      setCleanupActionLoadingId(id);
      setStatusMessage(null);
      const res = await fetch(`/api/posts/${id}/cleanup-retry`, { method: "POST" });
      const json = await res.json();
      if (res.ok && json.success) {
        setStatusMessage({
          type: "success",
          text: json.alreadyDeleted
            ? "Temporary image was already removed from Vercel Blob."
            : "Vercel Blob temporary image cleaned up successfully.",
        });
        await fetchPosts();
      } else {
        setStatusMessage({
          type: "error",
          text: json.error || "Failed to retry cleanup.",
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error executing cleanup retry";
      setStatusMessage({ type: "error", text: msg });
    } finally {
      setCleanupActionLoadingId(null);
    }
  };

  const handleCancelScheduled = async (id: string) => {
    try {
      setActionLoadingId(id);
      setStatusMessage(null);
      await fetch(`/api/posts`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "DRAFT" }),
      });
      await fetchPosts();
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

  const getPublicationBadge = (status: string) => {
    switch (status) {
      case "PUBLISHED":
        return (
          <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>PUBLISHED</span>
          </span>
        );
      case "PUBLISHING":
        return (
          <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center gap-1">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>PUBLISHING</span>
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

  const getLifecycleBadge = (lifecycle?: string | null) => {
    switch (lifecycle) {
      case "DELETED":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>BLOB: PURGED</span>
          </span>
        );
      case "CLEANUP_PENDING":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
            <Clock className="w-3 h-3 animate-pulse" />
            <span>CLEANUP PENDING</span>
          </span>
        );
      case "CLEANUP_FAILED":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1">
            <Trash2 className="w-3 h-3" />
            <span>CLEANUP FAILED</span>
          </span>
        );
      case "PUBLISHING":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center gap-1">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>PUBLISHING</span>
          </span>
        );
      case "READY_TO_PUBLISH":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center gap-1">
            <Layers className="w-3 h-3" />
            <span>READY TO PUBLISH</span>
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20 flex items-center gap-1">
            <span>TEMP: UPLOADED</span>
          </span>
        );
    }
  };

  return (
    <AdminShell
      title="Publishing Calendar"
      subtitle="Track scheduled publication queue, live Instagram posts, drafts, and temporary Vercel Blob lifecycle"
    >
      <div className="space-y-6">
        {statusMessage && (
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between text-xs transition-all ${
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
            <button
              onClick={() => setStatusMessage(null)}
              className="text-slate-400 hover:text-white ml-2 text-xs"
            >
              &times;
            </button>
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
                    {post.renderedImageUrl || post.temporaryImageUrl || post.blobUrl || post.prompt?.sourceImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={post.renderedImageUrl || post.temporaryImageUrl || post.blobUrl || post.prompt?.sourceImageUrl || ""}
                        alt="Post media"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Send className="w-5 h-5 text-slate-600" />
                    )}
                  </div>

                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {getPublicationBadge(post.status)}
                      {getLifecycleBadge(post.imageLifecycleStatus || post.renderedImageStatus)}
                      {post.prompt?.sourceImageStatus && post.prompt.sourceImageStatus !== "DELETED" && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                          SOURCE: {post.prompt.sourceImageStatus}
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">
                        KEYWORD: {post.commentKeyword}
                      </span>
                      {post.prompt?.category && (
                        <span className="text-[11px] text-slate-400">
                          {post.prompt.category}
                        </span>
                      )}
                    </div>

                    {post.prompt?.title && (
                      <h4 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
                        <span>{post.prompt.title}</span>
                        {post.prompt.slug && (
                          <Link
                            href={`/p/${post.prompt.slug}`}
                            target="_blank"
                            className="text-xs text-amber-400 hover:text-amber-300 font-mono inline-flex items-center gap-0.5"
                          >
                            <span>/p/{post.prompt.slug}</span>
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        )}
                      </h4>
                    )}

                    <p className="text-xs font-medium text-slate-300 line-clamp-2 leading-relaxed">
                      {post.caption}
                    </p>

                    <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400 font-mono pt-1">
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
                      {post.cleanupAttempts ? (
                        <span>Cleanup attempts: {post.cleanupAttempts}</span>
                      ) : null}
                    </div>

                    {post.lastCleanupError && (
                      <p className="text-[11px] text-rose-400 font-mono">
                        Cleanup Error: {post.lastCleanupError}
                      </p>
                    )}
                    {post.lastPublishError && (
                      <p className="text-[11px] text-rose-400 font-mono">
                        Publish Error: {post.lastPublishError}
                      </p>
                    )}
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

                  {post.imageLifecycleStatus === "CLEANUP_FAILED" && (
                    <button
                      onClick={() => handleRetryCleanup(post.id)}
                      disabled={cleanupActionLoadingId === post.id}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-medium transition-colors disabled:opacity-50"
                      title="Retry temporary Vercel Blob deletion"
                    >
                      <RotateCcw
                        className={`w-3.5 h-3.5 ${cleanupActionLoadingId === post.id ? "animate-spin" : ""}`}
                      />
                      <span>Retry Cleanup</span>
                    </button>
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
