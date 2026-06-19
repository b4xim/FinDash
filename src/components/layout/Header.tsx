"use client";

import { Bell, Search } from "lucide-react";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export default function Header({ title, subtitle }: HeaderProps) {
  // Get current date for display
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <header className="h-16 border-b border-white/5 bg-navy-900/50 backdrop-blur-sm flex items-center justify-between px-6 flex-shrink-0 sticky top-0 z-10">
      {/* Page title */}
      <div>
        <h1 className="font-display font-semibold text-text-primary text-lg leading-none">
          {title}
        </h1>
        {subtitle && (
          <p className="text-text-muted text-xs mt-1">{subtitle || today}</p>
        )}
      </div>

      {/* Right side — date + actions */}
      <div className="flex items-center gap-3">
        <p className="text-text-muted text-xs hidden md:block">{today}</p>
        <div className="h-4 w-px bg-white/10" />
        <button className="btn-ghost p-2 rounded-lg text-text-muted hover:text-text-primary">
          <Search size={16} />
        </button>
        <button className="btn-ghost p-2 rounded-lg text-text-muted hover:text-text-primary relative">
          <Bell size={16} />
          {/* Notification dot — show when there are pending syncs */}
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-violet rounded-full" />
        </button>
      </div>
    </header>
  );
}
