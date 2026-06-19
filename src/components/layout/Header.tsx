"use client";

import { Bell, Search, TrendingUp } from "lucide-react";

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
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-violet rounded-xl flex items-center justify-center shadow-violet-glow flex-shrink-0">
            <TrendingUp size={18} className="text-white" />
          </div>
          <div>
            <p className="font-display font-semibold text-text-primary leading-none">FinDash - Bladeoski</p>
            <p className="text-text-muted text-xs mt-0.5">{title}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="font-display font-semibold text-text-primary text-lg leading-none">{title}</p>
          {subtitle ? (
            <p className="text-text-muted text-xs mt-1">{subtitle}</p>
          ) : (
            <p className="text-text-muted text-xs mt-1">{today}</p>
          )}
        </div>

        <div className="h-4 w-px bg-white/10" />
        <p className="text-text-muted text-xs hidden md:block">{today}</p>
        <button className="btn-ghost p-2 rounded-lg text-text-muted hover:text-text-primary">
          <Search size={16} />
        </button>
        <button className="btn-ghost p-2 rounded-lg text-text-muted hover:text-text-primary relative">
          <Bell size={16} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-violet rounded-full" />
        </button>
      </div>
    </header>
  );
}
