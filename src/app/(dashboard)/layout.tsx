// ============================================================
// Dashboard layout — wraps all authenticated pages
// Includes session check server-side — redirect to login if not authed
// ============================================================

import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/session";
import Sidebar from "@/components/layout/Sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side auth guard — unauthenticated users get redirected
  const session = await requireAuth();
  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 bg-navy-950">
        {children}
      </div>
    </div>
  );
}
