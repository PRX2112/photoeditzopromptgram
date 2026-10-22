import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Generate a clean, URL-friendly slug from a title
 */
export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/[^\w-]+/g, "") // Remove all non-word chars
    .replace(/--+/g, "-") // Replace multiple - with single -
    .replace(/^-+/, "") // Trim - from start of text
    .replace(/-+$/, ""); // Trim - from end of text
}

/**
 * Format date for display
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "N/A";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "N/A";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

/**
 * Format relative time (e.g. "5 minutes ago", "in 2 hours")
 */
export function formatRelativeTime(date: Date | string | null | undefined): string {
  if (!date) return "N/A";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "N/A";

  const now = new Date();
  const diffInSeconds = Math.round((d.getTime() - now.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  const absDiff = Math.abs(diffInSeconds);
  if (absDiff < 60) return rtf.format(diffInSeconds, "second");
  if (absDiff < 3600) return rtf.format(Math.round(diffInSeconds / 60), "minute");
  if (absDiff < 86400) return rtf.format(Math.round(diffInSeconds / 3600), "hour");
  if (absDiff < 2592000) return rtf.format(Math.round(diffInSeconds / 86400), "day");
  return rtf.format(Math.round(diffInSeconds / 2592000), "month");
}

export const PHOTOGRAPHY_CATEGORIES = [
  "Wedding and bridal",
  "Couple and pre-wedding",
  "Fashion and editorial",
  "Maternity",
  "Newborn and baby",
  "Family portraits",
  "Cinematic portraits",
  "Product photography",
  "Creative lighting",
  "Studio photography",
] as const;

export type PhotographyCategory = typeof PHOTOGRAPHY_CATEGORIES[number];
