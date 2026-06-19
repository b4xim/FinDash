"use client";

import { Bell, Menu } from "lucide-react";
import { useMenuOpen } from "@/components/layout/DashboardShell";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export default function Header({ title, subtitle }: HeaderProps) {
  const openMenu = useMenuOpen();

  // Get current date for display
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <header className="h-14 md:h-16 border-b border-white/5 bg-navy-900/50 backdrop-blur-sm flex items-center justify-between px-4 md:px-6 flex-shrink-0 sticky top-0 z-10">
      {/* Left side — hamburger (mobile only) + page title */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Hamburger — only on mobile */}
        <button
          onClick={() => openMenu?.()}
          className="md:hidden p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-white/5 transition-colors flex-shrink-0"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>

        <div className="min-w-0">
          <h1 className="font-display font-semibold text-text-primary text-base md:text-lg leading-none truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-text-muted text-xs mt-0.5 hidden sm:block">{subtitle}</p>
          )}
        </div>
      </div>

      {/* Right side — date + actions */}
      <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
        <p className="text-text-muted text-xs hidden lg:block">{today}</p>
        <div className="h-4 w-px bg-white/10 hidden lg:block" />
        <button className="btn-ghost p-2 rounded-lg text-text-muted hover:text-text-primary relative">
          <Bell size={16} />
          {/* Notification dot — show when there are pending syncs */}
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-violet rounded-full" />
        </button>
      </div>
    </header>
  );
}
