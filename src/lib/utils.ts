// ============================================================
// Shared utility functions
// ============================================================

import { clsx, type ClassValue } from "clsx";

// Merge Tailwind classes safely (handles conditional classes)
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

// Format a number as Indian Rupees
// e.g. 125000 → "₹1,25,000"
export function formatINR(amount: number, compact = false): string {
  if (compact && amount >= 100000) {
    return `₹${(amount / 100000).toFixed(2)}L`;
  }
  if (compact && amount >= 1000) {
    return `₹${(amount / 1000).toFixed(1)}K`;
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

// Format a date string to a readable format
// e.g. "2024-01-15" → "15 Jan 2024"
export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Get the current month's start and end date strings
export function getCurrentMonthRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    start: start.toISOString().split("T")[0],
    end: end.toISOString().split("T")[0],
  };
}

// Calculate percentage change between two values
export function pctChange(current: number, previous: number): number {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

// Category colour map for charts
export const CATEGORY_COLORS: Record<string, string> = {
  "Food & Dining":   "#7C5CFC",
  "Shopping":        "#F5A623",
  "Transport":       "#10D98C",
  "Utilities":       "#38BDF8",
  "Entertainment":   "#F472B6",
  "Healthcare":      "#FB923C",
  "Investment":      "#A3E635",
  "Income":          "#10D98C",
  "Transfer":        "#8A94B2",
  "Other":           "#4A5270",
};

// Asset type colour map
export const ASSET_COLORS: Record<string, string> = {
  "mutual_fund": "#7C5CFC",
  "stock":       "#F5A623",
  "etf":         "#10D98C",
  "fd":          "#38BDF8",
  "ppf":         "#F472B6",
  "other":       "#8A94B2",
};
