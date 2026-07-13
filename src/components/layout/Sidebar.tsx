"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  TrendingUp, LayoutDashboard, CreditCard,
  PieChart, Settings, LogOut, ChevronRight, Landmark,
  Flag, Target, X, Sparkles, Handshake, Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Navigation links — update this array to add new pages
const NAV_ITEMS = [
  { href: "/overview",      label: "Overview",      icon: LayoutDashboard },
  { href: "/spending",      label: "Spending",      icon: CreditCard },
  { href: "/budget",        label: "Budget",        icon: Target },
  { href: "/credit-cards",  label: "Credit Cards",  icon: Wallet },
  { href: "/goals",         label: "Goals",         icon: Flag },
  { href: "/investing",     label: "Investing",     icon: PieChart },
  { href: "/smart-picks",   label: "Smart Picks",   icon: Sparkles },
  { href: "/emi",           label: "EMI Tracker",   icon: Landmark },
  { href: "/lending",       label: "Lending",       icon: Handshake },
  { href: "/settings",      label: "Settings",      icon: Settings },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const sidebarContent = (
    <aside className="w-64 h-full bg-navy-900 border-r border-white/5 flex flex-col">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-violet rounded-xl flex items-center justify-center shadow-violet-glow flex-shrink-0">
            <TrendingUp size={18} className="text-[#FFFFFF]" />
          </div>
          <div>
            <p className="font-display font-semibold text-text-primary leading-none">FinDash</p>
            <p className="text-text-muted text-xs mt-0.5">Personal Finance</p>
          </div>
        </div>
        {/* Close button — mobile only */}
        {onMobileClose && (
          <button
            onClick={onMobileClose}
            className="md:hidden p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-white/5 transition-colors"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="text-text-muted text-xs font-medium uppercase tracking-wider px-3 mb-3">
          Navigation
        </p>
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              onClick={onMobileClose}
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

  return (
    <>
      {/* ── Desktop sidebar (always visible on md+) ── */}
      <div className="hidden md:flex w-64 min-h-screen flex-shrink-0">
        {sidebarContent}
      </div>

      {/* ── Mobile drawer overlay ── */}
      <div
        className={cn(
          "fixed inset-0 z-50 md:hidden transition-all duration-300",
          mobileOpen ? "pointer-events-auto" : "pointer-events-none"
        )}
      >
        {/* Backdrop */}
        <div
          className={cn(
            "absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300",
            mobileOpen ? "opacity-100" : "opacity-0"
          )}
          onClick={onMobileClose}
        />
        {/* Drawer panel */}
        <div
          className={cn(
            "absolute left-0 top-0 h-full w-64 transition-transform duration-300 ease-out",
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          {sidebarContent}
        </div>
      </div>
    </>
  );
}
