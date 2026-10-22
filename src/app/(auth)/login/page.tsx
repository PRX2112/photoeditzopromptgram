"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Lock, Mail, ArrowRight, Sparkles, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@photographerprompthub.com");
  const [password, setPassword] = useState("PhotographerPromptAdmin2026!");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const json = await res.json();

      if (!res.ok || json.error) {
        throw new Error(json.error || "Authentication failed");
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Invalid credentials";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07080a] flex items-center justify-center p-4 selection:bg-amber-500 selection:text-black">
      <div className="max-w-md w-full space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 mx-auto shadow-lg shadow-amber-500/5">
            <Camera className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            Photographer Prompt Hub
          </h1>
          <p className="text-xs text-slate-400">
            Sign in to access editorial curator tools & Instagram automation
          </p>
        </div>

        {/* Login Form */}
        <div className="p-8 rounded-2xl bg-[#101217] border border-[#21252e] shadow-2xl space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-300 font-medium mb-1.5">
                Admin Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@photographerprompthub.com"
                  className="w-full pl-9 pr-3.5 py-2.5 bg-[#141720] border border-[#222734] rounded-lg text-white placeholder-slate-500 focus:border-amber-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-3.5 py-2.5 bg-[#141720] border border-[#222734] rounded-lg text-white placeholder-slate-500 focus:border-amber-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold flex items-center justify-center gap-2 transition-all hover:scale-[1.01] disabled:opacity-50"
            >
              <span>{loading ? "Authenticating..." : "Sign In to Studio"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Seed Credentials Hint Box */}
          <div className="p-3 rounded-lg bg-[#141720] border border-[#1e2330] text-[11px] text-slate-400 space-y-1">
            <span className="font-semibold text-slate-300 block">Default Admin Credentials:</span>
            <p className="font-mono text-[10px] text-amber-400/90">
              admin@photographerprompthub.com / PhotographerPromptAdmin2026!
            </p>
          </div>
        </div>

        <div className="text-center text-[11px] text-slate-600 font-mono">
          Single-Admin Mode &bull; Production Ready
        </div>
      </div>
    </div>
  );
}
