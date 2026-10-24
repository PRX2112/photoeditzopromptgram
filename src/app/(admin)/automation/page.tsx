"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/layout/AdminShell";
import {
  Inbox,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  MessageSquare,
  Clock,
  RotateCcw,
  ShieldAlert,
  HelpCircle,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { PromptRequestItem } from "@/types";

export default function AutomationInboxPage() {
  const [requests, setRequests] = useState<PromptRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [syncing, setSyncing] = useState(false);

  const fetchInbox = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/automation/inbox");
      const json = await res.json();
      if (json.data) {
        setRequests(json.data);
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  const handleSyncComments = async () => {
    try {
      setSyncing(true);
      setActionMessage(null);
      const res = await fetch("/api/instagram/sync-comments", { method: "POST" });
      const json = await res.json();
      if (res.ok && json.success) {
        setActionMessage({
          type: "success",
          text: `Synced ${json.totalCommentsFound} comment(s) from ${json.publishedPostsChecked} published post(s). Processed ${json.processedEvents} event(s).`,
        });
        await fetchInbox();
      } else {
        setActionMessage({
          type: "error",
          text: json.error || "Failed to sync comments from Instagram.",
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error syncing comments";
      setActionMessage({ type: "error", text: msg });
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchInbox();
  }, []);

  const handleRetry = async (requestId: string) => {
    try {
      setRetryingId(requestId);
      setActionMessage(null);
      const res = await fetch("/api/automation/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setActionMessage({
          type: "success",
          text: "Private reply retry triggered successfully.",
        });
        await fetchInbox();
      } else {
        setActionMessage({
          type: "error",
          text: json.error || "Failed to retry private reply.",
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error retrying private reply";
      setActionMessage({ type: "error", text: msg });
    } finally {
      setRetryingId(null);
    }
  };

  const filtered = requests.filter((r) => {
    if (statusFilter === "ALL") return true;
    if (statusFilter === "DELIVERED") {
      return r.deliveryStatus === "DELIVERED" || r.deliveryStatus === "SENT";
    }
    return r.deliveryStatus === statusFilter;
  });

  const deliveredCount = requests.filter(
    (r) => r.deliveryStatus === "DELIVERED" || r.deliveryStatus === "SENT"
  ).length;
  const suppressedCount = requests.filter((r) => r.deliveryStatus === "SUPPRESSED").length;
  const failedCount = requests.filter((r) => r.deliveryStatus === "FAILED").length;
  const unknownCount = requests.filter((r) => r.deliveryStatus === "UNKNOWN").length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DELIVERED":
      case "SENT":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" />
            <span>SENT (1-DM ENFORCED)</span>
          </span>
        );
      case "SUPPRESSED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-mono font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <ShieldAlert className="w-3 h-3" />
            <span>SUPPRESSED (REPEAT COMMENT)</span>
          </span>
        );
      case "UNKNOWN":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-mono font-medium bg-orange-500/10 text-orange-400 border border-orange-500/20">
            <HelpCircle className="w-3 h-3" />
            <span>UNKNOWN (AMBIGUOUS)</span>
          </span>
        );
      case "SENDING":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-mono font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>SENDING</span>
          </span>
        );
      case "RESERVED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-mono font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <Clock className="w-3 h-3" />
            <span>RESERVED</span>
          </span>
        );
      case "FAILED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-mono font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertTriangle className="w-3 h-3" />
            <span>FAILED</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
            <span>IGNORED</span>
          </span>
        );
    }
  };

  return (
    <AdminShell
      title="Automation Inbox"
      subtitle="Monitor incoming Instagram keyword comments, webhook processing results, private replies, and DM idempotency suppression"
    >
      <div className="space-y-6">
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

        {/* Metric Summary Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div className="p-4 rounded-xl bg-[#111317] border border-[#21252e]">
            <span className="text-[11px] font-medium text-slate-400">Total Ingested</span>
            <p className="text-xl font-bold text-white mt-1">{requests.length}</p>
          </div>
          <div className="p-4 rounded-xl bg-[#111317] border border-[#21252e]">
            <span className="text-[11px] font-medium text-emerald-400">Delivered DMs</span>
            <p className="text-xl font-bold text-emerald-400 mt-1">{deliveredCount}</p>
          </div>
          <div className="p-4 rounded-xl bg-[#111317] border border-[#21252e]">
            <span className="text-[11px] font-medium text-amber-400">Suppressed Repeats</span>
            <p className="text-xl font-bold text-amber-300 mt-1">{suppressedCount}</p>
          </div>
          <div className="p-4 rounded-xl bg-[#111317] border border-[#21252e]">
            <span className="text-[11px] font-medium text-rose-400">Delivery Failures</span>
            <p className="text-xl font-bold text-rose-400 mt-1">{failedCount}</p>
          </div>
          <div className="p-4 rounded-xl bg-[#111317] border border-[#21252e]">
            <span className="text-[11px] font-medium text-orange-400">Ambiguous / Unknown</span>
            <p className="text-xl font-bold text-orange-300 mt-1">{unknownCount}</p>
          </div>
        </div>

        {/* Filter and Refresh */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-lg bg-[#111317] border border-[#21252e] text-xs">
            {["ALL", "DELIVERED", "SUPPRESSED", "FAILED", "UNKNOWN", "IGNORED"].map((tab) => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                  statusFilter === tab
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
              onClick={handleSyncComments}
              disabled={syncing || loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
              <span>{syncing ? "Syncing Comments..." : "Sync Live Instagram Comments"}</span>
            </button>

            <button
              onClick={fetchInbox}
              disabled={loading || syncing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#14171f] border border-[#232834] text-xs text-slate-300 hover:text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh Inbox</span>
            </button>
          </div>
        </div>

        {/* Inbox Table */}
        <div className="rounded-xl bg-[#111317] border border-[#21252e] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#141720] border-b border-[#21252e] text-slate-400 font-mono text-[11px] uppercase">
                <tr>
                  <th className="px-4 py-3 font-semibold">Incoming Comment</th>
                  <th className="px-4 py-3 font-semibold">Commenter & Post</th>
                  <th className="px-4 py-3 font-semibold">Delivery Status & Safety</th>
                  <th className="px-4 py-3 font-semibold">Timestamp</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e222b]">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500">
                      Loading automation events...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-12 text-center text-slate-500">
                      <Inbox className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>No prompt requests found for this filter.</p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((item) => (
                    <tr key={item.id} className="hover:bg-[#141822] transition-colors">
                      {/* Comment Column */}
                      <td className="px-4 py-3.5 max-w-xs">
                        <div className="flex items-start gap-2.5">
                          <MessageSquare className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="font-medium text-slate-200 truncate">
                              &quot;{item.commentText || "Empty comment"}&quot;
                            </p>
                            <p className="text-[11px] text-slate-500 font-mono">
                              Comment ID: {item.firstCommentId || item.incomingCommentId}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Commenter & Post Column */}
                      <td className="px-4 py-3.5">
                        <div className="space-y-0.5">
                          <p className="text-slate-200 font-mono text-[11px]">
                            User ID: {item.instagramScopedUserId || item.commenterId || "unknown"}
                          </p>
                          {item.matchedPrompt ? (
                            <Link
                              href={`/p/${item.matchedPrompt.slug}`}
                              target="_blank"
                              className="font-medium text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
                            >
                              <span>{item.matchedPrompt.title}</span>
                              <ExternalLink className="w-3 h-3 text-slate-500" />
                            </Link>
                          ) : (
                            <span className="text-slate-500 italic">No prompt matched</span>
                          )}
                        </div>
                      </td>

                      {/* Status Column */}
                      <td className="px-4 py-3.5">
                        <div className="space-y-1">
                          {getStatusBadge(item.deliveryStatus)}

                          {item.deliveryStatus === "SUPPRESSED" && (
                            <p className="text-[10px] text-slate-400 font-mono">
                              Idempotency: User already received private reply for this post.
                            </p>
                          )}

                          {item.deliveryStatus === "UNKNOWN" && (
                            <p className="text-[10px] text-orange-400/90 font-mono">
                              Ambiguous delivery: Network timeout. Never blindly resend.
                            </p>
                          )}

                          {(item.lastError || item.errorMessage) && (
                            <p className="text-[10px] text-rose-400/90 font-mono">
                              {item.lastError || item.errorMessage}
                            </p>
                          )}
                          {(item.metaMessageId || item.privateReplyId) && (
                            <p className="text-[10px] text-slate-500 font-mono">
                              Msg ID: {item.metaMessageId || item.privateReplyId}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Time Column */}
                      <td className="px-4 py-3.5 text-[11px] text-slate-400 font-mono">
                        {formatDate(item.createdAt)}
                      </td>

                      {/* Action Column */}
                      <td className="px-4 py-3.5 text-right">
                        {item.deliveryStatus === "FAILED" && (
                          <button
                            onClick={() => handleRetry(item.id)}
                            disabled={retryingId === item.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[11px] font-medium transition-colors disabled:opacity-50"
                          >
                            <RotateCcw
                              className={`w-3 h-3 ${retryingId === item.id ? "animate-spin" : ""}`}
                            />
                            <span>Retry</span>
                          </button>
                        )}
                        {(item.deliveryStatus === "DELIVERED" || item.deliveryStatus === "SENT") && (
                          <span className="text-[11px] text-emerald-400 font-mono">
                            Delivered
                          </span>
                        )}
                        {item.deliveryStatus === "SUPPRESSED" && (
                          <span className="text-[11px] text-slate-500 font-mono">
                            Suppressed
                          </span>
                        )}
                        {item.deliveryStatus === "UNKNOWN" && (
                          <span className="text-[11px] text-orange-400 font-mono">
                            Manual review
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
