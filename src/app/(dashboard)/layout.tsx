// ============================================================
// Dashboard layout — wraps all authenticated pages
// Includes session check server-side — redirect to login if not authed
// ============================================================

import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/session";
import DashboardShell from "@/components/layout/DashboardShell";

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

  return <DashboardShell>{children}</DashboardShell>;
}
