"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  TrendingUp, LayoutDashboard, CreditCard,
  PieChart, RefreshCw, Settings, LogOut, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Navigation links — update this array to add new pages
const NAV_ITEMS = [
  { href: "/overview",   label: "Overview",   icon: LayoutDashboard },
  { href: "/spending",   label: "Spending",   icon: CreditCard },
  { href: "/investing",  label: "Investing",  icon: PieChart },
  { href: "/sync",       label: "Sync",       icon: RefreshCw },
  { href: "/settings",   label: "Settings",   icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="w-64 min-h-screen bg-navy-900 border-r border-white/5 flex flex-col">

      {/* Logo */}
      <div className="px-6 py-6 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-violet rounded-xl flex items-center justify-center shadow-violet-glow flex-shrink-0">
            <TrendingUp size={18} className="text-white" />
          </div>
          <div>
            <p className="font-display font-semibold text-text-primary leading-none">FinDash</p>
            <p className="text-text-muted text-xs mt-0.5">Personal Finance</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <p className="text-text-muted text-xs font-medium uppercase tracking-wider px-3 mb-3">
          Navigation
        </p>
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group",
                active
                  ? "bg-violet/15 text-violet-light border border-violet/20"
                  : "text-text-secondary hover:bg-white/5 hover:text-text-primary"
              )}
            >
              <Icon
                size={18}
                className={cn(
                  "flex-shrink-0 transition-colors",
                  active ? "text-violet-light" : "text-text-muted group-hover:text-text-secondary"
                )}
              />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight size={14} className="text-violet/60" />}
            </Link>
          );
        })}
      </nav>

      {/* Logout button */}
      <div className="px-3 py-4 border-t border-white/5">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-text-secondary hover:bg-rose-fin/10 hover:text-rose-fin transition-all duration-200 group"
        >
          <LogOut size={18} className="flex-shrink-0 transition-colors group-hover:text-rose-fin" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
