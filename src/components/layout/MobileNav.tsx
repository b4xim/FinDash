"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, CreditCard, PieChart, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Show only the 4 most-used pages in the bottom bar
const BOTTOM_NAV = [
  { href: "/overview",    label: "Overview",    icon: LayoutDashboard },
  { href: "/spending",    label: "Spending",    icon: CreditCard },
  { href: "/investing",   label: "Invest",      icon: PieChart },
  { href: "/smart-picks", label: "Smart Picks", icon: Sparkles },
];

/**
 * Bottom navigation bar — visible only on mobile (md:hidden).
 * Provides thumb-friendly access to the 5 core pages.
 * Add `pb-16` to your main content wrapper to avoid overlap.
 */
export default function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="relative z-40 md:hidden border-t border-white/5 bg-navy-900/90 backdrop-blur-md flex-shrink-0">
      <div className="flex items-stretch h-16">
        {BOTTOM_NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors duration-200 pt-1",
                active ? "text-violet-light" : "text-text-muted"
              )}
            >
              <div
                className={cn(
                  "w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200",
                  active ? "bg-violet/20" : "bg-transparent"
                )}
              >
                <Icon size={18} />
              </div>
              {label}
            </Link>
          );
        })}
      </div>
      {/* Safe-area bottom padding for iPhone notch */}
      <div className="h-safe-area-bottom bg-navy-900/90" />
    </nav>
  );
}
