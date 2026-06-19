// ============================================================
// Session management using iron-session
// Iron-session signs & encrypts a cookie — no DB needed for auth
// ============================================================

import { getIronSession, SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { SessionData } from "@/types";

// Cookie configuration
export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET as string, // Must be 32+ chars
  cookieName: "fin-session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
};

// Get the current session (server-side only)
export async function getSession() {
  const session = await getIronSession<SessionData>(
    await cookies(),
    sessionOptions
  );
  return session;
}

// Check if the user is logged in — redirect if not
export async function requireAuth() {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return null;
  }
  return session;
}
