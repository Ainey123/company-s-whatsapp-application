import React from "react";
import { cn } from "@/lib/utils";

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  isOnline?: boolean;
  className?: string;
}

export function Avatar({ src, name, size = "md", isOnline, className }: AvatarProps) {
  const sizeClasses = {
    xs: "w-7 h-7 text-xs",
    sm: "w-9 h-9 text-sm",
    md: "w-11 h-11 text-base",
    lg: "w-14 h-14 text-lg",
    xl: "w-20 h-20 text-2xl font-bold",
  };

  const badgeSizeClasses = {
    xs: "w-2 h-2 ring-1",
    sm: "w-2.5 h-2.5 ring-1.5",
    md: "w-3 h-3 ring-2",
    lg: "w-3.5 h-3.5 ring-2",
    xl: "w-4 h-4 ring-2",
  };

  const getInitials = (n: string) => {
    if (!n) return "?";
    const parts = n.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return n.substring(0, 2).toUpperCase();
  };

  return (
    <div className={cn("relative inline-block shrink-0 select-none", className)}>
      {src ? (
        <img
          src={src}
          alt={name}
          className={cn(
            "rounded-full object-cover shadow-sm bg-neutral-200 dark:bg-neutral-800",
            sizeClasses[size]
          )}
          onError={(e) => {
            // Fallback to initials if image fails
            (e.target as HTMLElement).style.display = "none";
            const fallback = (e.target as HTMLElement).nextElementSibling;
            if (fallback) (fallback as HTMLElement).style.display = "flex";
          }}
        />
      ) : null}

      <div
        style={{ display: src ? "none" : "flex" }}
        className={cn(
          "rounded-full items-center justify-center font-medium bg-gradient-to-tr from-brand-700 to-brand-500 text-white shadow-sm",
          sizeClasses[size]
        )}
      >
        {getInitials(name)}
      </div>

      {isOnline !== undefined && (
        <span
          className={cn(
            "absolute bottom-0 right-0 rounded-full ring-white dark:ring-chat-darkBg",
            isOnline ? "bg-emerald-500" : "bg-neutral-400",
            badgeSizeClasses[size]
          )}
          title={isOnline ? "Online" : "Offline"}
        />
      )}
    </div>
  );
}
