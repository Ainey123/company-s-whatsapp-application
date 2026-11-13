"use client";

import React, { useState } from "react";
import {
  X,
  User,
  Mail,
  Phone,
  Briefcase,
  Building,
  ShieldCheck,
  Check,
  Lock,
  KeyRound,
  AlertCircle,
  Eye,
  EyeOff,
  Settings,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { RoleBadge } from "@/components/ui/Badge";
import { useAuth } from "@/components/providers/AuthProvider";

interface ProfileModalProps {
  onClose: () => void;
}

export function ProfileModal({ onClose }: ProfileModalProps) {
  const { user, refreshUser } = useAuth();

  const [activeTab, setActiveTab] = useState<"PROFILE" | "SECURITY">("PROFILE");
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [avatar, setAvatar] = useState(user?.avatar || "");
  
  // Security Passcode (Required: 9999)
  const [passcode, setPasscode] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passcodeError, setPasscodeError] = useState<string | null>(null);

  // Password Change
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (!user) return null;

  // Verify Passcode 9999
  const handleVerifyPasscode = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setPasscodeError(null);

    if (passcode.trim() === "9999") {
      setIsUnlocked(true);
      setPasscodeError(null);
    } else {
      setIsUnlocked(false);
      setPasscodeError("Invalid passcode! You must enter security passcode '9999' to edit name or password.");
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // If changing name or setting password, enforce passcode 9999
    const isChangingName = displayName.trim() !== user.displayName;
    const isChangingPassword = Boolean(newPassword.trim());

    if ((isChangingName || isChangingPassword) && (!isUnlocked || passcode.trim() !== "9999")) {
      setFormError("Security Passcode 9999 is required to change your name or password.");
      setActiveTab("SECURITY");
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      setFormError("New password and confirmation do not match.");
      return;
    }

    if (newPassword && newPassword.length < 6) {
      setFormError("Password must be at least 6 characters long.");
      return;
    }

    try {
      setSaving(true);
      const payload: any = {
        displayName: displayName.trim(),
        avatar: avatar.trim(),
        passcode: passcode.trim(),
      };

      if (newPassword.trim()) {
        payload.password = newPassword.trim();
      }

      const res = await fetch(`/api/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        await refreshUser();
        setSavedSuccess(true);
        setNewPassword("");
        setConfirmPassword("");
        setTimeout(() => setSavedSuccess(false), 2500);
      } else {
        setFormError(data.error || "Failed to update profile settings.");
      }
    } catch (err: any) {
      setFormError(err.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150 select-none">
      <div className="bg-white dark:bg-chat-darkPanel border border-neutral-200 dark:border-chat-darkBorder rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-100 dark:border-chat-darkBorder flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-brand-600 dark:text-emerald-400" />
            <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
              Profile & Account Settings
            </h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-full text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-neutral-100 dark:border-chat-darkBorder px-5 pt-2 bg-neutral-50/50 dark:bg-chat-darkIn/40 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab("PROFILE")}
            className={`pb-2.5 px-3 border-b-2 transition-colors ${
              activeTab === "PROFILE"
                ? "border-brand-600 text-brand-700 dark:text-emerald-400"
                : "border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
            }`}
          >
            Employee Info
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("SECURITY")}
            className={`pb-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === "SECURITY"
                ? "border-brand-600 text-brand-700 dark:text-emerald-400"
                : "border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Security (Change Name & Password)</span>
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSave} className="p-5 space-y-4 overflow-y-auto">
          {formError && (
            <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-400 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          {/* TAB 1: EMPLOYEE INFO */}
          {activeTab === "PROFILE" && (
            <div className="space-y-4">
              <div className="flex flex-col items-center text-center">
                <Avatar src={avatar} name={displayName || user.username} size="xl" className="mb-2" />
                <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                  {user.displayName}
                </h3>
                <span className="text-xs text-neutral-500">@{user.username}</span>
                <div className="mt-1.5">
                  <RoleBadge role={user.role} />
                </div>
              </div>

              {/* Readonly company credentials */}
              <div className="p-3.5 bg-neutral-50 dark:bg-chat-darkIn rounded-2xl space-y-2.5 text-xs text-neutral-600 dark:text-neutral-300 border border-neutral-100 dark:border-chat-darkBorder">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Designation</span>
                  <span className="font-semibold">{user.designation || "Staff Member"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Department</span>
                  <span className="font-semibold">{user.department || "Enterprise"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Work Email</span>
                  <span className="font-semibold">{user.email}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">WhatsApp Mobile</span>
                  <span className="font-semibold text-brand-600 dark:text-emerald-400">{user.phone}</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
                  Avatar Photo URL
                </label>
                <input
                  type="url"
                  value={avatar}
                  onChange={(e) => setAvatar(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full px-3 py-2 text-xs bg-neutral-100 dark:bg-chat-darkIn border border-neutral-200 dark:border-chat-darkBorder rounded-xl focus:outline-hidden focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-[11px] text-amber-800 dark:text-amber-300">
                💡 To modify your <strong>Display Name</strong> or <strong>Password</strong>, click on the <strong>Security</strong> tab and enter passcode <strong>9999</strong>.
              </div>
            </div>
          )}

          {/* TAB 2: SECURITY & PASSCODE 9999 GATE */}
          {activeTab === "SECURITY" && (
            <div className="space-y-4">
              {/* Passcode 9999 Gate Card */}
              <div className={`p-4 rounded-2xl border transition-all ${
                isUnlocked
                  ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"
                  : "bg-neutral-50 dark:bg-chat-darkIn border-neutral-200 dark:border-chat-darkBorder"
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Lock className={`w-4 h-4 ${isUnlocked ? "text-emerald-600" : "text-neutral-500"}`} />
                    <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                      Security Passcode Verification
                    </span>
                  </div>
                  {isUnlocked && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300">
                      Unlocked ✓
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mb-3 leading-relaxed">
                  Enter the 4-digit security passcode (<strong>9999</strong>) to unlock editing your display name and password.
                </p>

                <div className="flex gap-2">
                  <input
                    type="password"
                    maxLength={6}
                    value={passcode}
                    onChange={(e) => {
                      setPasscode(e.target.value);
                      if (e.target.value.trim() === "9999") {
                        setIsUnlocked(true);
                        setPasscodeError(null);
                      }
                    }}
                    placeholder="Enter passcode 9999"
                    className="w-full px-3 py-2 text-xs font-mono tracking-widest bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-chat-darkBorder rounded-xl focus:outline-hidden focus:ring-2 focus:ring-brand-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleVerifyPasscode()}
                    className="px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold whitespace-nowrap shadow-xs"
                  >
                    Unlock
                  </button>
                </div>

                {passcodeError && (
                  <p className="text-[11px] text-red-600 mt-2 font-medium">{passcodeError}</p>
                )}
              </div>

              {/* UNLOCKED EDITABLE FIELDS */}
              <div className={`space-y-3.5 transition-opacity ${!isUnlocked ? "opacity-50 pointer-events-none" : "opacity-100"}`}>
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!isUnlocked}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your full name"
                    className="w-full px-3 py-2 text-xs bg-neutral-100 dark:bg-chat-darkIn border border-neutral-200 dark:border-chat-darkBorder rounded-xl focus:outline-hidden focus:ring-1.5 focus:ring-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    New Password
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type={showPassword ? "text" : "password"}
                      disabled={!isUnlocked}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Leave blank to keep current password"
                      className="w-full pl-3 pr-9 py-2 text-xs bg-neutral-100 dark:bg-chat-darkIn border border-neutral-200 dark:border-chat-darkBorder rounded-xl focus:outline-hidden focus:ring-1.5 focus:ring-brand-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 text-neutral-400 hover:text-neutral-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    disabled={!isUnlocked}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full px-3 py-2 text-xs bg-neutral-100 dark:bg-chat-darkIn border border-neutral-200 dark:border-chat-darkBorder rounded-xl focus:outline-hidden focus:ring-1.5 focus:ring-brand-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Save Button */}
          <button
            type="submit"
            disabled={saving || (activeTab === "SECURITY" && !isUnlocked)}
            className="w-full py-2.5 px-4 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {savedSuccess ? (
              <>
                <Check className="w-4 h-4 text-emerald-200" /> Changes Saved Successfully!
              </>
            ) : saving ? (
              "Saving Changes..."
            ) : (
              "Save Changes"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
