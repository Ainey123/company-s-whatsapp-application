"use client";

import React, { useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { MessageSquare, ShieldCheck, Lock, User, ArrowRight, Building, CheckCircle2 } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await login(identifier, password);
    if (!res.success) {
      setError(res.error || "Authentication failed. Please verify your credentials.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center bg-[#F0F2F5] dark:bg-[#0C1317] p-4 select-none relative overflow-hidden">
      {/* Top Emerald Header Accent Bar */}
      <div className="fixed top-0 left-0 right-0 h-56 bg-brand-800 dark:bg-[#005C4B] z-0 shadow-md" />

      {/* Main Authentication Card */}
      <div className="relative z-10 w-full max-w-md bg-white dark:bg-chat-darkPanel rounded-3xl shadow-2xl border border-neutral-200/80 dark:border-chat-darkBorder overflow-hidden p-8 sm:p-10">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="p-3.5 rounded-2xl bg-brand-600 text-white shadow-lg mb-3.5">
            <MessageSquare className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-brand-900 dark:text-emerald-400 tracking-tight flex items-center gap-1.5">
            Connect<span className="text-brand-600 dark:text-emerald-300">Pro</span>
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium mt-1">
            Enterprise Private Communication Platform
          </p>
        </div>

        {/* Welcome Text */}
        <div className="mb-6">
          <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
            Sign in to your workplace
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Enter your corporate username, work email, or registered mobile number.
          </p>
        </div>

        {error && (
          <div className="p-3.5 mb-5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-400 leading-relaxed animate-in fade-in duration-150">
            {error}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
              Username, Work Email or Mobile
            </label>
            <div className="relative flex items-center">
              <User className="absolute left-3.5 w-4 h-4 text-neutral-400 pointer-events-none" />
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="e.g. admin or john.doe@company.com"
                className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-neutral-100 dark:bg-chat-darkIn border border-neutral-200 dark:border-chat-darkBorder rounded-xl focus:outline-hidden focus:ring-1.5 focus:ring-brand-500 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
              Password
            </label>
            <div className="relative flex items-center">
              <Lock className="absolute left-3.5 w-4 h-4 text-neutral-400 pointer-events-none" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-neutral-100 dark:bg-chat-darkIn border border-neutral-200 dark:border-chat-darkBorder rounded-xl focus:outline-hidden focus:ring-1.5 focus:ring-brand-500 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 mt-2 cursor-pointer active:scale-98"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Authenticating...
              </span>
            ) : (
              <>
                <span>Sign In to ConnectPro</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Corporate Notice */}
        <div className="mt-8 pt-5 border-t border-neutral-100 dark:border-chat-darkBorder text-center">
          <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
            Need an account? Please contact your company's System Administrator to provision your corporate workspace.
          </p>
        </div>

        {/* Footer Security Badges */}
        <div className="mt-5 flex items-center justify-center gap-2 text-[10px] text-neutral-400 font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Independent Enterprise Communication • Encrypted P2P Calling</span>
        </div>
      </div>
    </div>
  );
}
