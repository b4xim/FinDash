// Root page — redirect to login or overview based on session
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/session";

export default async function RootPage() {
  const session = await requireAuth();
  if (session) {
    redirect("/overview");
  } else {
    redirect("/login");
  }
}
