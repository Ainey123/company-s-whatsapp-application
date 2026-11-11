import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, isToday, isYesterday, formatDistanceToNow } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMessageTime(date: Date | string | number): string {
  const d = new Date(date);
  return format(d, "h:mm a");
}

export function formatChatListTime(date: Date | string | number): string {
  const d = new Date(date);
  if (isToday(d)) {
    return format(d, "h:mm a");
  }
  if (isYesterday(d)) {
    return "Yesterday";
  }
  return format(d, "dd/MM/yyyy");
}

export function formatLastSeen(date: Date | string | number, isOnline: boolean): string {
  if (isOnline) return "Online";
  const d = new Date(date);
  if (isToday(d)) {
    return `Last seen today at ${format(d, "h:mm a")}`;
  }
  if (isYesterday(d)) {
    return `Last seen yesterday at ${format(d, "h:mm a")}`;
  }
  return `Last seen ${format(d, "MMM d, yyyy")}`;
}

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}
