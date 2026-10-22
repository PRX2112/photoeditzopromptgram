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
  Sparkles,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { PromptRequestItem } from "@/types";

export default function AutomationInboxPage() {
  const [requests, setRequests] = useState<PromptRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

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

  useEffect(() => {
    fetchInbox();
  }, []);

  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleRetry = async (requestId: string) => {
    try {
      setRetryingId(requestId);
      setStatusMessage(null);
      const res = await fetch("/api/automation/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || "Retry failed");
      }
      setStatusMessage({ type: "success", text: "Prompt delivery retried and verified successfully via Meta Private Reply!" });
      fetchInbox();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Retry failed";
      setStatusMessage({ type: "error", text: msg });
    } finally {
      setRetryingId(null);
    }
  };

  const filtered = requests.filter((r) => {
    if (statusFilter === "ALL") return true;
    return r.deliveryStatus === statusFilter;
  });

  const deliveredCount = requests.filter((r) => r.deliveryStatus === "DELIVERED").length;
  const failedCount = requests.filter((r) => r.deliveryStatus === "FAILED").length;
  const ignoredCount = requests.filter((r) => r.deliveryStatus === "IGNORED").length;

  return (
    <AdminShell
      title="Automation Inbox"
      subtitle="Monitor incoming Instagram keyword comments, webhook processing results, and private replies"
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
                <AlertTriangle className="w-4 h-4 text-rose-400" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          </div>
        )}

        {/* Metric Summary Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-[#111317] border border-[#21252e]">
            <span className="text-[11px] font-medium text-slate-400">Total Requests</span>
            <p className="text-xl font-bold text-white mt-1">{requests.length}</p>
          </div>
          <div className="p-4 rounded-xl bg-[#111317] border border-[#21252e]">
            <span className="text-[11px] font-medium text-emerald-400">Delivered Links</span>
            <p className="text-xl font-bold text-emerald-400 mt-1">{deliveredCount}</p>
          </div>
          <div className="p-4 rounded-xl bg-[#111317] border border-[#21252e]">
            <span className="text-[11px] font-medium text-rose-400">Delivery Failures</span>
            <p className="text-xl font-bold text-rose-400 mt-1">{failedCount}</p>
          </div>
          <div className="p-4 rounded-xl bg-[#111317] border border-[#21252e]">
            <span className="text-[11px] font-medium text-slate-400">Ignored (No Keyword)</span>
            <p className="text-xl font-bold text-slate-300 mt-1">{ignoredCount}</p>
          </div>
        </div>

        {/* Filter and Refresh */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 p-1 rounded-lg bg-[#111317] border border-[#21252e] text-xs">
            {["ALL", "DELIVERED", "FAILED", "IGNORED"].map((tab) => (
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

          <button
            onClick={fetchInbox}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#14171f] border border-[#232834] text-xs text-slate-300 hover:text-white transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh Inbox</span>
          </button>
        </div>

        {/* Inbox Table */}
        <div className="rounded-xl bg-[#111317] border border-[#21252e] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#141720] border-b border-[#21252e] text-slate-400 font-mono text-[11px] uppercase">
                <tr>
                  <th className="px-4 py-3 font-semibold">Incoming Comment</th>
                  <th className="px-4 py-3 font-semibold">Matched Post & Prompt</th>
                  <th className="px-4 py-3 font-semibold">Status & Delivery Method</th>
                  <th className="px-4 py-3 font-semibold">Time</th>
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
                              ID: {item.incomingCommentId}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Matched Prompt Column */}
                      <td className="px-4 py-3.5">
                        {item.matchedPrompt ? (
                          <div>
                            <Link
                              href={`/p/${item.matchedPrompt.slug}`}
                              target="_blank"
                              className="font-medium text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
                            >
                              <span>{item.matchedPrompt.title}</span>
                              <ExternalLink className="w-3 h-3 text-slate-500" />
                            </Link>
                            <span className="text-[11px] text-slate-500 font-mono">
                              /p/{item.matchedPrompt.slug}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-500 italic">No prompt matched</span>
                        )}
                      </td>

                      {/* Status Column */}
                      <td className="px-4 py-3.5">
                        <div className="space-y-1">
                          {item.deliveryStatus === "DELIVERED" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>DELIVERED (DM)</span>
                            </span>
                          ) : item.deliveryStatus === "FAILED" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-mono font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                              <AlertTriangle className="w-3 h-3" />
                              <span>FAILED</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
                              <span>IGNORED</span>
                            </span>
                          )}

                          {item.errorMessage && (
                            <p className="text-[10px] text-rose-400/90 font-mono">
                              {item.errorMessage}
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
                            <RotateCcw className={`w-3 h-3 ${retryingId === item.id ? "animate-spin" : ""}`} />
                            <span>Retry</span>
                          </button>
                        )}
                        {item.deliveryStatus === "DELIVERED" && (
                          <span className="text-[11px] text-slate-500 font-mono">
                            Done
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
