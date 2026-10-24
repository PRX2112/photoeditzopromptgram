"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/layout/AdminShell";
import {
  Sparkles,
  Send,
  Inbox,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  TrendingUp,
  Radio,
  Zap,
  RefreshCw,
  Trash2,
  ShieldAlert,
  RotateCcw,
  ExternalLink,
  Clock,
  Layers,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { PostItem } from "@/types";

interface DashboardMetrics {
  totalPrompts: number;
  publishedPosts: number;
  scheduledPosts: number;
  publishingPosts: number;
  failedPosts: number;
  incomingRequests: number;
  successfulDeliveries: number;
  deliveryFailures: number;
  suppressedRequests: number;
  unknownDeliveries: number;
  sendingDeliveries: number;
  cleanupPendingCount: number;
  cleanupFailedCount: number;
  cleanupDeletedCount: number;
  imageUploadedCount: number;
  webhookFailures: number;
  recentActivity: Array<{
    id: string;
    action: string;
    entityType: string;
    createdAt: string;
    details?: Record<string, unknown>;
  }>;
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [recentPosts, setRecentPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cleanupActionLoadingId, setCleanupActionLoadingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [metricsRes, postsRes] = await Promise.all([
        fetch("/api/metrics"),
        fetch("/api/posts"),
      ]);

      if (metricsRes.ok) {
        const metricsJson = await metricsRes.json();
        if (metricsJson.data) {
          setMetrics(metricsJson.data);
        }
      }

      if (postsRes.ok) {
        const postsJson = await postsRes.json();
        if (postsJson.data) {
          setRecentPosts(postsJson.data.slice(0, 5));
        }
      }
    } catch {
      // Fallback fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleRetryCleanup = async (postId: string) => {
    try {
      setCleanupActionLoadingId(postId);
      setActionMessage(null);
      const res = await fetch(`/api/posts/${postId}/cleanup-retry`, { method: "POST" });
      const json = await res.json();
      if (res.ok && json.success) {
        setActionMessage({
          type: "success",
          text: json.alreadyDeleted
            ? "Temporary image was already removed from Vercel Blob."
            : "Vercel Blob temporary image cleaned up successfully.",
        });
        await fetchDashboardData();
      } else {
        setActionMessage({
          type: "error",
          text: json.error || "Failed to retry cleanup.",
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error executing cleanup retry";
      setActionMessage({ type: "error", text: msg });
    } finally {
      setCleanupActionLoadingId(null);
    }
  };

  const getLifecycleBadge = (lifecycle?: string) => {
    switch (lifecycle) {
      case "DELETED":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>BLOB: DELETED</span>
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

  const getPublicationBadge = (status: string) => {
    switch (status) {
      case "PUBLISHED":
        return (
          <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>IG: PUBLISHED</span>
          </span>
        );
      case "PUBLISHING":
        return (
          <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center gap-1">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>IG: PUBLISHING</span>
          </span>
        );
      case "SCHEDULED":
        return (
          <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>IG: SCHEDULED</span>
          </span>
        );
      case "FAILED":
        return (
          <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            <span>IG: FAILED</span>
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
            DRAFT
          </span>
        );
    }
  };

  const deliveryRate =
    metrics && metrics.incomingRequests > 0
      ? Math.round((metrics.successfulDeliveries / metrics.incomingRequests) * 100)
      : 100;

  return (
    <AdminShell
      title="Editorial Dashboard"
      subtitle="Overview of photography prompt catalog, Instagram publication status, Vercel Blob lifecycle, and DM idempotency"
    >
      <div className="space-y-6">
        {/* Top Status Notification Banner */}
        {actionMessage && (
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between text-xs transition-all ${
              actionMessage.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                : "bg-rose-500/10 border-rose-500/30 text-rose-300"
            }`}
          >
            <div className="flex items-center gap-2">
              {actionMessage.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-400" />
              )}
              <span>{actionMessage.text}</span>
            </div>
            <button
              onClick={() => setActionMessage(null)}
              className="text-slate-400 hover:text-white ml-2 text-xs"
            >
              &times;
            </button>
          </div>
        )}

        {/* Top Status Banner */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-[#14171e] via-[#161a24] to-[#12141a] border border-[#232834] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-white">Temporary Storage & DM Idempotency Active</h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Enforced
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Ephemeral Vercel Blob objects are purged post-publish. Exactly 1 automated DM permitted per user per post.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchDashboardData}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1a1e27] hover:bg-[#222733] border border-[#2b313e] text-xs text-slate-300 font-medium transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
            <Link
              href="/composer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold transition-all hover:scale-[1.02]"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Compose Post</span>
            </Link>
          </div>
        </div>

        {/* 6 Key Performance Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {/* Card 1: Total Prompts */}
          <Link
            href="/prompts"
            className="p-4 rounded-xl bg-[#111317] border border-[#21252e] hover:border-amber-500/40 transition-colors group flex flex-col justify-between"
          >
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-medium">Prompt Library</span>
              <Sparkles className="w-4 h-4 text-amber-400" />
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold text-white tracking-tight">
                {loading ? "..." : metrics?.totalPrompts ?? 0}
              </span>
              <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                <span>Original prompts</span>
                <ArrowUpRight className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </p>
            </div>
          </Link>

          {/* Card 2: Published Posts */}
          <Link
            href="/calendar"
            className="p-4 rounded-xl bg-[#111317] border border-[#21252e] hover:border-emerald-500/40 transition-colors group flex flex-col justify-between"
          >
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-medium">Published Posts</span>
              <Send className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold text-emerald-400 tracking-tight">
                {loading ? "..." : metrics?.publishedPosts ?? 0}
              </span>
              <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                <span>With Media ID</span>
              </p>
            </div>
          </Link>

          {/* Card 3: Blob Cleanup Status */}
          <div className="p-4 rounded-xl bg-[#111317] border border-[#21252e] flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-medium">Blob Cleanup</span>
              <Trash2 className="w-4 h-4 text-teal-400" />
            </div>
            <div className="mt-3">
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-white tracking-tight">
                  {loading ? "..." : metrics?.cleanupDeletedCount ?? 0}
                </span>
                <span className="text-xs text-slate-400">purged</span>
              </div>
              <div className="text-[11px] mt-1 flex items-center gap-1.5">
                {(metrics?.cleanupFailedCount ?? 0) > 0 ? (
                  <span className="text-rose-400 font-medium">
                    {metrics?.cleanupFailedCount} failed
                  </span>
                ) : (metrics?.cleanupPendingCount ?? 0) > 0 ? (
                  <span className="text-amber-400">
                    {metrics?.cleanupPendingCount} pending
                  </span>
                ) : (
                  <span className="text-slate-500">Storage synchronized</span>
                )}
              </div>
            </div>
          </div>

          {/* Card 4: DM Deliveries */}
          <Link
            href="/automation"
            className="p-4 rounded-xl bg-[#111317] border border-[#21252e] hover:border-purple-500/40 transition-colors group flex flex-col justify-between"
          >
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-medium">DM Deliveries</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold text-white tracking-tight">
                {loading ? "..." : metrics?.successfulDeliveries ?? 0}
              </span>
              <p className="text-[11px] text-emerald-400/90 mt-1 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                <span>{deliveryRate}% delivery rate</span>
              </p>
            </div>
          </Link>

          {/* Card 5: Suppressed Repeat Comments */}
          <Link
            href="/automation"
            className="p-4 rounded-xl bg-[#111317] border border-[#21252e] hover:border-amber-500/40 transition-colors group flex flex-col justify-between"
          >
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-medium">Suppressed (Idempotent)</span>
              <ShieldAlert className="w-4 h-4 text-amber-400" />
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold text-amber-300 tracking-tight">
                {loading ? "..." : metrics?.suppressedRequests ?? 0}
              </span>
              <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                <span>Repeat user comments</span>
              </p>
            </div>
          </Link>

          {/* Card 6: Failures & Unknowns */}
          <Link
            href="/automation"
            className="p-4 rounded-xl bg-[#111317] border border-[#21252e] hover:border-rose-500/40 transition-colors group flex flex-col justify-between"
          >
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-medium">Failures & Unknowns</span>
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold text-rose-400 tracking-tight">
                {loading
                  ? "..."
                  : (metrics?.deliveryFailures ?? 0) + (metrics?.unknownDeliveries ?? 0)}
              </span>
              <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                {metrics?.unknownDeliveries ? (
                  <span>{metrics.unknownDeliveries} unknown outcome</span>
                ) : (
                  <span>Requires safe review</span>
                )}
              </p>
            </div>
          </Link>
        </div>

        {/* Dual Lifecycle & Publication Post Feed */}
        <div className="p-6 rounded-xl bg-[#101217] border border-[#21252e]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-400" />
                <span>Publication Status & Image Lifecycle State</span>
              </h3>
              <p className="text-xs text-slate-400">
                Instagram publication status is decoupled from temporary Vercel Blob lifecycle. Posts remain PUBLISHED even if cleanup requires retry.
              </p>
            </div>
            <Link
              href="/calendar"
              className="text-xs text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1"
            >
              <span>View full calendar</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-3">
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 rounded-lg bg-[#141720] animate-pulse" />
                ))}
              </div>
            ) : recentPosts.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">
                No recent posts created yet.
              </div>
            ) : (
              recentPosts.map((post) => (
                <div
                  key={post.id}
                  className="p-4 rounded-xl bg-[#13161e] border border-[#212633] flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {getPublicationBadge(post.status)}
                      {getLifecycleBadge(post.imageLifecycleStatus)}
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">
                        KEYWORD: {post.commentKeyword}
                      </span>
                    </div>

                    {post.prompt?.title && (
                      <h4 className="text-xs font-semibold text-white tracking-tight">
                        {post.prompt.title}
                      </h4>
                    )}

                    <p className="text-xs text-slate-300 line-clamp-1 font-medium">
                      {post.caption}
                    </p>

                    <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400 font-mono">
                      {post.instagramMediaId && (
                        <span>Media ID: {post.instagramMediaId}</span>
                      )}
                      {post.publishedAt && (
                        <span>Published: {formatDate(post.publishedAt)}</span>
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
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-center flex-shrink-0">
                    {post.instagramPermalink && (
                      <a
                        href={post.instagramPermalink}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#181d28] hover:bg-[#202737] text-slate-300 text-xs font-medium border border-[#2b3345] transition-colors"
                      >
                        <span>Instagram</span>
                        <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                      </a>
                    )}

                    {post.imageLifecycleStatus === "CLEANUP_FAILED" && (
                      <button
                        onClick={() => handleRetryCleanup(post.id)}
                        disabled={cleanupActionLoadingId === post.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-medium transition-colors disabled:opacity-50"
                      >
                        <RotateCcw
                          className={`w-3.5 h-3.5 ${cleanupActionLoadingId === post.id ? "animate-spin" : ""}`}
                        />
                        <span>Retry Cleanup</span>
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Architecture & Automation Flow Walkthrough */}
        <div className="p-6 rounded-xl bg-[#101217] border border-[#21252e]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Radio className="w-4 h-4 text-amber-500" />
                <span>Automated Instagram Comment-to-DM Pipeline</span>
              </h3>
              <p className="text-xs text-slate-400">
                Official Meta Graph API messaging policy compliant (Single private reply per user/post)
              </p>
            </div>
            <Link
              href="/settings"
              className="text-xs text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1"
            >
              <span>Configure rules</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-[#141720] border border-[#222734]">
              <span className="text-amber-400 font-mono font-bold block mb-1">01. Follower Comment</span>
              <p className="text-slate-300">
                A user comments with your configured keyword (e.g. <span className="text-amber-300 font-mono">BRIDAL</span>).
              </p>
            </div>
            <div className="p-3 rounded-lg bg-[#141720] border border-[#222734]">
              <span className="text-amber-400 font-mono font-bold block mb-1">02. Webhook Ingestion</span>
              <p className="text-slate-300">
                Meta sends HMAC-SHA256 signed comment payload. App performs idempotency check.
              </p>
            </div>
            <div className="p-3 rounded-lg bg-[#141720] border border-[#222734]">
              <span className="text-amber-400 font-mono font-bold block mb-1">03. Atomic Reservation</span>
              <p className="text-slate-300">
                DB uniqueness on (postId, instagramScopedUserId) guarantees exactly 1 DM reply.
              </p>
            </div>
            <div className="p-3 rounded-lg bg-[#141720] border border-[#222734]">
              <span className="text-amber-400 font-mono font-bold block mb-1">04. Private Reply & Cleanup</span>
              <p className="text-slate-300">
                Official Messenger API delivers DM. Blob purged only after confirmed publication.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Section: Recent Activity & Quick Navigation */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Activity Feed */}
          <div className="lg:col-span-2 p-5 rounded-xl bg-[#101217] border border-[#21252e]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">Recent Automation & Publishing Activity</h3>
              <Link href="/automation" className="text-xs text-slate-400 hover:text-white transition-colors">
                View all logs &rarr;
              </Link>
            </div>

            <div className="space-y-3">
              {metrics?.recentActivity && metrics.recentActivity.length > 0 ? (
                metrics.recentActivity.map((act) => (
                  <div
                    key={act.id}
                    className="p-3 rounded-lg bg-[#14171f] border border-[#212632] flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-md bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-mono text-[11px]">
                        ✓
                      </div>
                      <div>
                        <span className="font-medium text-slate-200">
                          {act.action === "POST_PUBLISHED"
                            ? "Instagram post published successfully"
                            : act.action === "PRIVATE_REPLY_SENT"
                            ? "Private reply DM sent with prompt link"
                            : act.action === "BLOB_CLEANUP_COMPLETED"
                            ? "Temporary Vercel Blob removed"
                            : "Scheduled post queued for publication"}
                        </span>
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {act.details?.title
                            ? String(act.details.title)
                            : `Keyword: ${act.details?.keyword || "PROMPT"}`}
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {formatDate(act.createdAt)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-xs text-slate-500">
                  No activity recorded yet.
                </div>
              )}
            </div>
          </div>

          {/* Quick Shortcuts */}
          <div className="p-5 rounded-xl bg-[#101217] border border-[#21252e] flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white mb-3">Quick Navigation</h3>
              <div className="space-y-2 text-xs">
                <Link
                  href="/prompts"
                  className="p-3 rounded-lg bg-[#14171f] border border-[#212632] hover:border-amber-500/40 flex items-center justify-between text-slate-300 hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>Manage Prompt Categories & Slugs</span>
                  </div>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-500" />
                </Link>

                <Link
                  href="/composer"
                  className="p-3 rounded-lg bg-[#14171f] border border-[#212632] hover:border-amber-500/40 flex items-center justify-between text-slate-300 hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Send className="w-4 h-4 text-emerald-400" />
                    <span>Draft New Post with Gemini AI</span>
                  </div>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-500" />
                </Link>

                <Link
                  href="/automation"
                  className="p-3 rounded-lg bg-[#14171f] border border-[#212632] hover:border-amber-500/40 flex items-center justify-between text-slate-300 hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Inbox className="w-4 h-4 text-purple-400" />
                    <span>Review Keyword Ingestion Inbox</span>
                  </div>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-500" />
                </Link>

                <Link
                  href="/settings"
                  className="p-3 rounded-lg bg-[#14171f] border border-[#212632] hover:border-amber-500/40 flex items-center justify-between text-slate-300 hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-sky-400" />
                    <span>Meta Credentials & Health Status</span>
                  </div>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-500" />
                </Link>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-[#1e232d] text-[11px] text-slate-500 flex items-center justify-between">
              <span>Neon PostgreSQL + Vercel Blob</span>
              <span className="font-mono text-emerald-400">Online</span>
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
