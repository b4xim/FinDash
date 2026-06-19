// ============================================================
// GET /api/mf-search?q=hdfc+flexi+cap
// Proxies MFapi.in's search so the browser doesn't call a
// third-party API directly (keeps things server-side, avoids CORS)
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";

export async function GET(req: NextRequest) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");

  if (!q || q.trim().length < 3) {
    return NextResponse.json([]); // Don't search on very short queries
  }

  try {
    // MFapi.in search endpoint — no auth required
    const res = await fetch(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(q)}`);

    if (!res.ok) {
      return NextResponse.json({ error: "MFapi search failed" }, { status: 502 });
    }

    const data = await res.json();
    // Limit results so the dropdown stays manageable
    return NextResponse.json(data.slice(0, 15));
  } catch (err) {
    console.error("MF search error:", err);
    return NextResponse.json({ error: "Failed to reach MFapi.in" }, { status: 502 });
  }
}
