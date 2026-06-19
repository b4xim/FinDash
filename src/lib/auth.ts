// ============================================================
// NextAuth config — used ONLY for Gmail OAuth, not app login
// The app login is the separate password gate (see lib/session.ts)
// This is purely to get a Gmail read-only access token.
// ============================================================

import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { getSupabaseAdmin } from "./supabase";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          // Read-only Gmail scope — we never send or modify email
          scope: "openid email profile https://www.googleapis.com/auth/gmail.readonly",
          access_type: "offline", // Required to get a refresh_token
          prompt: "consent",      // Forces refresh_token on every connect (Google only sends it once otherwise)
        },
      },
    }),
  ],
  callbacks: {
    // Runs whenever a JWT is created/updated — this is where we persist tokens to Supabase
    async jwt({ token, account }) {
      // `account` is only present on initial sign-in
      if (account) {
        const supabase = getSupabaseAdmin();

        // Store tokens in app_settings — single-user app, so no need for a sessions table
        await supabase.from("app_settings").upsert([
          { key: "gmail_access_token", value: account.access_token ?? "" },
          { key: "gmail_refresh_token", value: account.refresh_token ?? "" },
          { key: "gmail_token_expires_at", value: String(account.expires_at ?? 0) },
          { key: "gmail_connected_email", value: token.email ?? "" },
        ]);
      }
      return token;
    },
    async session({ session }) {
      return session;
    },
  },
  pages: {
    // Redirect errors back to settings page with a query param
    error: "/settings",
  },
};
