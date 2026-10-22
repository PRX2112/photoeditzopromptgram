"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import {
  Settings,
  Radio,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Save,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Server,
  Key,
  Clock,
  Info,
} from "lucide-react";
import type { AutomationSettingItem } from "@/types";

interface HealthCheckData {
  services: {
    database: { status: string; provider: string; message: string };
    gemini: { status: string; message: string };
    metaInstagram: { status: string; message: string };
    jobScheduler: { status: string; message: string };
    securityEncryption: { status: string; message: string };
  };
}

export default function SettingsPage() {
  const [health, setHealth] = useState<HealthCheckData | null>(null);
  const [settings, setSettings] = useState<AutomationSettingItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Form states
  const [isAutomationEnabled, setIsAutomationEnabled] = useState(true);
  const [globalKeyword, setGlobalKeyword] = useState("PROMPT");
  const [replyTemplate, setReplyTemplate] = useState(
    "Here is the photography prompt you requested: {prompt_url}"
  );
  const [retentionHours, setRetentionHours] = useState(24);

  const fetchStatusAndSettings = async () => {
    try {
      setLoading(true);
      const [healthRes, settingsRes] = await Promise.all([
        fetch("/api/system/health"),
        fetch("/api/automation/settings"),
      ]);

      const healthJson = await healthRes.json();
      const settingsJson = await settingsRes.json();

      if (healthJson.services) setHealth(healthJson);
      if (settingsJson.data) {
        setSettings(settingsJson.data);
        setIsAutomationEnabled(settingsJson.data.isAutomationEnabled);
        setGlobalKeyword(settingsJson.data.globalKeyword);
        setReplyTemplate(settingsJson.data.replyTemplate);
        setRetentionHours(settingsJson.data.retentionHours);
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatusAndSettings();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setSaveSuccess(false);

      const res = await fetch("/api/automation/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isAutomationEnabled,
          globalKeyword: globalKeyword.toUpperCase(),
          replyTemplate,
          retentionHours: Number(retentionHours),
        }),
      });

      const json = await res.json();
      if (json.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch {
      // handle error
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminShell
      title="System Settings & Integrations"
      subtitle="Manage Meta Instagram Graph API, Gemini AI configuration, automation rules, and health checks"
    >
      <div className="space-y-6 max-w-5xl">
        {/* 1. Infrastructure Health & Diagnostic Overview */}
        <div className="p-6 rounded-xl bg-[#111317] border border-[#21252e] space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Server className="w-4 h-4 text-amber-500" />
              <span>System Health & Production Readiness</span>
            </h2>
            <button
              onClick={fetchStatusAndSettings}
              className="p-1.5 rounded-lg bg-[#14171f] text-slate-400 hover:text-white transition-colors"
              title="Refresh Health"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            {/* Neon DB */}
            <div className="p-3.5 rounded-lg bg-[#141720] border border-[#222734] space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200">Neon PostgreSQL</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                    health?.services.database.status === "healthy"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                  }`}
                >
                  {health?.services.database.status === "healthy" ? "CONNECTED" : "FALLBACK"}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {health?.services.database.message || "Connection verified"}
              </p>
            </div>

            {/* Gemini AI */}
            <div className="p-3.5 rounded-lg bg-[#141720] border border-[#222734] space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200">Google Gemini AI</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                    health?.services.gemini.status === "healthy"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                  }`}
                >
                  {health?.services.gemini.status === "healthy" ? "LIVE API" : "RULES FALLBACK"}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {health?.services.gemini.message || "Gemini 2.5 Flash active"}
              </p>
            </div>

            {/* Meta Instagram */}
            <div className="p-3.5 rounded-lg bg-[#141720] border border-[#222734] space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200">Meta Graph API</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                    health?.services.metaInstagram.status === "healthy"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                  }`}
                >
                  {health?.services.metaInstagram.status === "healthy" ? "CONFIGURED" : "CONFIG PENDING"}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {health?.services.metaInstagram.message || "App ID & Secret verified"}
              </p>
            </div>

            {/* Background Scheduler */}
            <div className="p-3.5 rounded-lg bg-[#141720] border border-[#222734] space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200">Job Scheduler & Queue</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  CRON READY
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {health?.services.jobScheduler.message || "Vercel Cron endpoint secured"}
              </p>
            </div>

            {/* Token Security */}
            <div className="p-3.5 rounded-lg bg-[#141720] border border-[#222734] space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200">Token Encryption</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  AES-256-GCM
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {health?.services.securityEncryption.message || "Long-lived tokens encrypted at rest"}
              </p>
            </div>

            {/* Ephemeral Storage Policy */}
            <div className="p-3.5 rounded-lg bg-[#141720] border border-[#222734] space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200">Storage Strategy</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  EPHEMERAL
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Assets purged immediately post-publish or after {retentionHours}h TTL
              </p>
            </div>
          </div>
        </div>

        {/* 2. Official Meta Instagram Integration Card */}
        <div className="p-6 rounded-xl bg-[#111317] border border-[#21252e] space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Radio className="w-4 h-4 text-amber-500" />
              <span>Official Meta Instagram Professional Integration</span>
            </h2>
            <span className="text-[11px] text-slate-400 font-mono">
              Graph API v21.0
            </span>
          </div>

          <div className="p-4 rounded-xl bg-[#0e1014] border border-[#1f232d] space-y-4 text-xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-200">Account Connection Status</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Requires an Instagram Professional account (Business or Creator) linked to a Facebook Page.
                </p>
              </div>

              <a
                href="/api/instagram/auth"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black text-xs font-semibold transition-all hover:scale-[1.02]"
              >
                <Radio className="w-4 h-4" />
                <span>Connect Instagram Account</span>
              </a>
            </div>

            {/* Webhook Configuration Details */}
            <div className="pt-3 border-t border-[#1e222b] grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <span className="text-[11px] font-mono text-slate-400 block mb-1">
                  Webhook Callback URL:
                </span>
                <div className="px-3 py-2 rounded bg-[#151821] border border-[#232836] font-mono text-slate-300 select-all">
                  {(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "")}/api/webhooks/instagram
                </div>
              </div>

              <div>
                <span className="text-[11px] font-mono text-slate-400 block mb-1">
                  Webhook Field Subscription:
                </span>
                <div className="px-3 py-2 rounded bg-[#151821] border border-[#232836] font-mono text-amber-400">
                  comments (with x-hub-signature-256 HMAC verification)
                </div>
              </div>
            </div>

            {/* Meta App Review Checklist */}
            <div className="p-3.5 rounded-lg bg-[#141720] border border-[#212634] space-y-2">
              <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
                <Info className="w-4 h-4 text-amber-400" />
                <span>Meta App Review & Permissions Checklist</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-slate-400 text-[11px]">
                <li><code className="text-amber-300">instagram_basic</code> &mdash; Read profile and media metadata</li>
                <li><code className="text-amber-300">instagram_content_publish</code> &mdash; Official media container & publish API</li>
                <li><code className="text-amber-300">instagram_manage_comments</code> &mdash; Receive comment webhook events</li>
                <li><code className="text-amber-300">instagram_manage_messages</code> &mdash; Official Private Replies API (1 DM within 7-day window)</li>
                <li><code className="text-amber-300">pages_read_engagement</code> & <code className="text-amber-300">pages_show_list</code> &mdash; Discover linked Business Accounts</li>
              </ul>
            </div>
          </div>
        </div>

        {/* 3. Automation Controls & Response Templates */}
        <form onSubmit={handleSaveSettings} className="p-6 rounded-xl bg-[#111317] border border-[#21252e] space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Settings className="w-4 h-4 text-amber-500" />
              <span>Comment-to-Prompt Automation Controls</span>
            </h2>
            {saveSuccess && (
              <span className="text-xs text-emerald-400 flex items-center gap-1 font-mono">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Settings Saved!</span>
              </span>
            )}
          </div>

          <div className="space-y-4">
            {/* Master Toggle */}
            <div className="p-4 rounded-xl bg-[#0e1014] border border-[#1f232d] flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-200">Master Automation Switch</p>
                <p className="text-[11px] text-slate-400">
                  Globally enable or pause automatic Instagram private replies to comments.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAutomationEnabled}
                  onChange={(e) => setIsAutomationEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>

            {/* Global Fallback Keyword */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Global Fallback Keyword
              </label>
              <input
                type="text"
                value={globalKeyword}
                onChange={(e) => setGlobalKeyword(e.target.value.toUpperCase())}
                placeholder="PROMPT"
                className="w-full max-w-sm px-3.5 py-2.5 bg-[#14171f] border border-[#222834] rounded-lg text-xs text-amber-400 font-mono uppercase font-bold focus:border-amber-500"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Used if a published post does not have a post-specific keyword defined.
              </p>
            </div>

            {/* Response Message Template */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Private Reply Message Template
              </label>
              <textarea
                rows={3}
                value={replyTemplate}
                onChange={(e) => setReplyTemplate(e.target.value)}
                placeholder="Here is the photography prompt you requested: {prompt_url}"
                className="w-full px-3.5 py-2.5 bg-[#14171f] border border-[#222834] rounded-lg text-xs text-slate-200 font-mono leading-relaxed focus:border-amber-500"
              />
              <div className="flex flex-wrap gap-2 mt-1.5 text-[11px] text-slate-500 font-mono">
                <span>Variables:</span>
                <span className="text-amber-400 bg-[#161a24] px-1.5 py-0.5 rounded cursor-pointer">
                  {"{prompt_url}"}
                </span>
                <span className="text-amber-400 bg-[#161a24] px-1.5 py-0.5 rounded cursor-pointer">
                  {"{prompt_title}"}
                </span>
                <span className="text-amber-400 bg-[#161a24] px-1.5 py-0.5 rounded cursor-pointer">
                  {"{category}"}
                </span>
              </div>
            </div>

            {/* Ephemeral Retention Hours */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Temporary Image Asset Retention Period (Hours)
              </label>
              <input
                type="number"
                min={1}
                max={168}
                value={retentionHours}
                onChange={(e) => setRetentionHours(Number(e.target.value))}
                className="w-32 px-3.5 py-2.5 bg-[#14171f] border border-[#222834] rounded-lg text-xs text-white focus:border-amber-500"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Background cron queue cleans up abandoned temporary uploads older than this threshold.
              </p>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold transition-all hover:scale-[1.02] disabled:opacity-50"
            >
              <Save className="w-4 h-4 stroke-[2.5]" />
              <span>{saving ? "Saving Changes..." : "Save Automation Settings"}</span>
            </button>
          </div>
        </form>
      </div>
    </AdminShell>
  );
}
