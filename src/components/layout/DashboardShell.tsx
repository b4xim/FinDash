"use client";

import { useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import MobileNav from "@/components/layout/MobileNav";

/**
 * Client wrapper that owns the mobile sidebar open/close state.
 * Rendered inside the server DashboardLayout after auth.
 */
export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar — passes toggle handlers for mobile drawer */}
      <Sidebar
        mobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 bg-navy-950">
        {/*
          Pages render their own <Header> and need access to openMenu.
          We pass it via a context so every page's Header can trigger it.
        */}
        <MenuContext.Provider value={() => setSidebarOpen(true)}>
          {/* Extra bottom padding on mobile so content isn't hidden behind MobileNav */}
          <div className="flex-1 flex flex-col pb-16 md:pb-0">
            {children}
          </div>
        </MenuContext.Provider>
      </div>

      {/* Bottom tab bar — mobile only */}
      <MobileNav />
    </div>
  );
}

// ── Thin context so nested Headers can open the sidebar ──────
import { createContext, useContext } from "react";

const MenuContext = createContext<(() => void) | null>(null);

export function useMenuOpen() {
  return useContext(MenuContext);
}
