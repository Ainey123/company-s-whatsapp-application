"use client";

import React, { useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { MessageSquare, ShieldCheck, Phone, ArrowRight, Lock, User, AlertCircle, CheckCircle2, KeyRound } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  
  // Login method tabs: PASSWORD or PHONE (WhatsApp mobile number)
  const [loginMethod, setLoginMethod] = useState<"PASSWORD" | "PHONE">("PASSWORD");

  // Password fields
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  // Phone field
  const [phoneNumber, setPhoneNumber] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (loginMethod === "PASSWORD") {
      const res = await login(identifier.trim(), password);
      if (!res.success) {
        setError(res.error || "Invalid username or password.");
        setLoading(false);
      }
    } else {
      const trimmedPhone = phoneNumber.trim();
      if (!trimmedPhone) {
        setError("Please enter your registered WhatsApp phone number");
        setLoading(false);
        return;
      }

      const res = await login(trimmedPhone);
      if (!res.success) {
        setError(res.error || "This mobile number is not registered in ConnectPro.");
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center bg-[#F0F2F5] dark:bg-[#0C1317] p-4 select-none relative overflow-hidden font-sans">
      {/* WhatsApp Green Top Banner */}
      <div className="fixed top-0 left-0 right-0 h-56 bg-[#00A884] dark:bg-[#005C4B] z-0 shadow-md transition-colors" />

      {/* Main Authentication Card */}
      <div className="relative z-10 w-full max-w-md bg-white dark:bg-chat-darkPanel rounded-3xl shadow-2xl border border-neutral-200/80 dark:border-chat-darkBorder overflow-hidden p-8 sm:p-10">
        
        {/* WhatsApp Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="p-4 rounded-2xl bg-[#25D366] text-white shadow-lg mb-3 flex items-center justify-center">
            <MessageSquare className="w-8 h-8 fill-current" />
          </div>
          <h1 className="text-2xl font-black text-neutral-900 dark:text-neutral-100 tracking-tight flex items-center gap-1.5">
            Connect<span className="text-[#00A884]">Pro</span>
          </h1>
          <div className="flex items-center gap-1.5 mt-1 text-[11px] font-semibold text-[#00A884] bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full">
            <CheckCircle2 className="w-3 h-3" />
            <span>Enterprise Workspace</span>
          </div>
        </div>

        {/* Method Switcher Tabs */}
        <div className="grid grid-cols-2 p-1 bg-neutral-100 dark:bg-chat-darkIn rounded-2xl mb-6 text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setLoginMethod("PASSWORD");
              setError(null);
            }}
            className={`py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              loginMethod === "PASSWORD"
                ? "bg-white dark:bg-neutral-800 text-[#00A884] shadow-xs"
                : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Admin Password</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setLoginMethod("PHONE");
              setError(null);
            }}
            className={`py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              loginMethod === "PHONE"
                ? "bg-white dark:bg-neutral-800 text-[#00A884] shadow-xs"
                : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
            }`}
          >
            <Phone className="w-3.5 h-3.5" />
            <span>WhatsApp Number</span>
          </button>
        </div>

        {/* Error Alert Box */}
        {error && (
          <div className="p-3.5 mb-5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-400 leading-relaxed flex items-start gap-2.5 animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
            <div className="flex-1">{error}</div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {loginMethod === "PASSWORD" ? (
            <>
              <div>
                <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                  Username or Work Email
                </label>
                <div className="relative flex items-center">
                  <User className="absolute left-3.5 w-4 h-4 text-neutral-400 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Enter username or work email"
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-neutral-100 dark:bg-chat-darkIn border border-neutral-200 dark:border-chat-darkBorder rounded-xl focus:outline-hidden focus:ring-1.5 focus:ring-[#00A884] text-neutral-900 dark:text-neutral-100"
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
                    placeholder="Enter your password"
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-neutral-100 dark:bg-chat-darkIn border border-neutral-200 dark:border-chat-darkBorder rounded-xl focus:outline-hidden focus:ring-1.5 focus:ring-[#00A884] text-neutral-900 dark:text-neutral-100"
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                  WhatsApp Mobile Number
                </label>
                <div className="relative flex items-center">
                  <Phone className="absolute left-3.5 w-4 h-4 text-neutral-400 pointer-events-none" />
                  <input
                    type="tel"
                    required
                    autoFocus
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="Enter your registered mobile number"
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-neutral-100 dark:bg-chat-darkIn border border-neutral-200 dark:border-chat-darkBorder rounded-xl focus:outline-hidden focus:ring-1.5 focus:ring-[#00A884] text-neutral-900 dark:text-neutral-100"
                  />
                </div>
                <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1">
                  Instant login for employee numbers registered in company Contacts.
                </p>
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-[#00A884] hover:bg-[#008f6f] disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 mt-2 cursor-pointer active:scale-98"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Signing in...
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
        <div className="mt-6 pt-4 border-t border-neutral-100 dark:border-chat-darkBorder text-center">
          <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
            Settings Protection: Change name & password inside app using security passcode <strong>9999</strong>.
          </p>
        </div>

        {/* Footer Security Badge */}
        <div className="mt-4 flex items-center justify-center gap-2 text-[10px] text-neutral-400 font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-[#00A884]" />
          <span>Independent Enterprise Communication • Encrypted P2P</span>
        </div>
      </div>
    </div>
  );
}
