import React from "react";
import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "success" | "warning" | "danger" | "purple";
  className?: string;
  size?: "sm" | "md";
}

export function Badge({ children, variant = "primary", className, size = "sm" }: BadgeProps) {
  const variantClasses = {
    primary: "bg-emerald-50 text-brand-700 border-brand-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800",
    secondary: "bg-neutral-100 text-neutral-700 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700",
    success: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-400 dark:border-green-800",
    warning: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800",
    danger: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800",
    purple: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800",
  };

  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs font-medium",
    md: "px-2.5 py-1 text-xs font-semibold",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border shadow-xs tracking-tight",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
    >
      {children}
    </span>
  );
}

export function RoleBadge({ role }: { role: string }) {
  switch (role) {
    case "SUPER_ADMIN":
      return <Badge variant="purple">Super Admin</Badge>;
    case "ADMIN":
      return <Badge variant="primary">Admin</Badge>;
    case "MANAGER":
      return <Badge variant="warning">Manager</Badge>;
    default:
      return <Badge variant="secondary">Employee</Badge>;
  }
}
