// ============================================================
// Gmail helper — token refresh + fetching/parsing messages
// All Gmail API calls go through here, server-side only
// ============================================================

import { getSupabaseAdmin } from "./supabase";

// ── Read stored tokens from app_settings ──
async function getStoredTokens() {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", ["gmail_access_token", "gmail_refresh_token", "gmail_token_expires_at", "gmail_connected_email"]);

  const map: Record<string, string> = {};
  data?.forEach(row => { map[row.key] = row.value; });
  return {
    accessToken: map.gmail_access_token || null,
    refreshToken: map.gmail_refresh_token || null,
    expiresAt: parseInt(map.gmail_token_expires_at || "0"),
    connectedEmail: map.gmail_connected_email || null,
  };
}

// ── Refresh the access token if it's expired ──
async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!res.ok) {
      console.error("Token refresh failed:", await res.text());
      return null;
    }

    const data = await res.json();
    const newExpiresAt = Math.floor(Date.now() / 1000) + data.expires_in;

    // Persist the new access token
    const supabase = getSupabaseAdmin();
    await supabase.from("app_settings").upsert([
      { key: "gmail_access_token", value: data.access_token },
      { key: "gmail_token_expires_at", value: String(newExpiresAt) },
    ]);

    return data.access_token;
  } catch (err) {
    console.error("Token refresh error:", err);
    return null;
  }
}

// ── Get a valid access token, refreshing if needed ──
export async function getValidAccessToken(): Promise<string | null> {
  const tokens = await getStoredTokens();
  if (!tokens.accessToken || !tokens.refreshToken) return null;

  const now = Math.floor(Date.now() / 1000);
  // Refresh if expired or expiring within 60 seconds
  if (tokens.expiresAt - now < 60) {
    return refreshAccessToken(tokens.refreshToken);
  }
  return tokens.accessToken;
}

// ── Check if Gmail is connected at all ──
export async function isGmailConnected(): Promise<{ connected: boolean; email: string | null }> {
  const tokens = await getStoredTokens();
  return { connected: !!tokens.refreshToken, email: tokens.connectedEmail };
}

// ── Disconnect Gmail — clears stored tokens ──
export async function disconnectGmail(): Promise<void> {
  const supabase = getSupabaseAdmin();
  await supabase
    .from("app_settings")
    .delete()
    .in("key", ["gmail_access_token", "gmail_refresh_token", "gmail_token_expires_at", "gmail_connected_email"]);
}

// ── Senders we care about — used to build the Gmail search query ──
export const RELEVANT_SENDERS = [
  // Bank/card transaction alerts
  "credit_cards@icici.bank.in",
  "alerts@sbicard.com",
  "onlinesbicard@sbicard.com",
  "alerts@axis.bank.in",
  "alerts@hdfcbank.bank.in",
  // Investment platforms
  "noreply@zerodha.com",
  "support@groww.in",
  "noreply@5paisa.com",
];

interface GmailMessage {
  id: string;
  threadId: string;
}

interface GmailMessageDetail {
  id: string;
  snippet: string;
  internalDate: string;
  payload: {
    headers: { name: string; value: string }[];
    body?: { data?: string };
    parts?: { mimeType: string; body: { data?: string } }[];
  };
}

// ── Build the Gmail search query, optionally filtered by date ──
function buildSearchQuery(afterTimestamp?: number): string {
  const senderQuery = RELEVANT_SENDERS.map(s => `from:${s}`).join(" OR ");
  let query = `(${senderQuery})`;
  if (afterTimestamp) {
    // Gmail search uses seconds-since-epoch for `after:`
    query += ` after:${Math.floor(afterTimestamp / 1000)}`;
  }
  return query;
}

// ── List message IDs matching our search query ──
export async function listRelevantMessages(accessToken: string, afterTimestamp?: number): Promise<GmailMessage[]> {
  const query = buildSearchQuery(afterTimestamp);
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=50`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Gmail list failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return data.messages || [];
}

// ── Fetch full details for a single message ──
export async function getMessageDetail(accessToken: string, messageId: string): Promise<GmailMessageDetail> {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Gmail get message failed: ${res.status} ${await res.text()}`);
  }

  return res.json();
}

// ── Extract plain-text body from a Gmail message payload ──
export function extractBodyText(payload: GmailMessageDetail["payload"]): string {
  // Simple body (no parts)
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf-8");
  }

  // Multipart — find the text/plain part (fallback to text/html, stripped)
  if (payload.parts) {
    const plainPart = payload.parts.find(p => p.mimeType === "text/plain");
    if (plainPart?.body?.data) {
      return Buffer.from(plainPart.body.data, "base64").toString("utf-8");
    }
    const htmlPart = payload.parts.find(p => p.mimeType === "text/html");
    if (htmlPart?.body?.data) {
      const html = Buffer.from(htmlPart.body.data, "base64").toString("utf-8");
      // Strip tags crudely — good enough for regex parsing afterwards
      return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ");
    }
  }

  return "";
}

// ── Get a specific header value ──
export function getHeader(payload: GmailMessageDetail["payload"], name: string): string {
  return payload.headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || "";
}

// ── NEW: Extract raw HTML body (for credit-card statement parsing) ──
// Unlike extractBodyText(), this does NOT strip HTML tags.
// Needed for Axis Bank / SBI statements where the regex targets HTML table structure.
export function extractHtmlBody(payload: GmailMessageDetail["payload"]): string {
  // Simple body (no parts)
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf-8");
  }

  if (payload.parts) {
    // Prefer text/html for credit card statement parsing (tables)
    const htmlPart = payload.parts.find(p => p.mimeType === "text/html");
    if (htmlPart?.body?.data) {
      return Buffer.from(htmlPart.body.data, "base64").toString("utf-8");
    }
    // Fall back to plain text if no HTML
    const plainPart = payload.parts.find(p => p.mimeType === "text/plain");
    if (plainPart?.body?.data) {
      return Buffer.from(plainPart.body.data, "base64").toString("utf-8");
    }
  }

  return "";
}

// ── NEW: Download a Gmail message attachment by attachmentId ──
// Returns the decoded binary data as a Buffer.
// Used to download PDF statement attachments for Federal Bank and HDFC cards.
export async function downloadAttachment(
  accessToken: string,
  messageId: string,
  attachmentId: string
): Promise<Buffer> {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Gmail attachment download failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  // Gmail returns attachment data as base64url (URL-safe base64)
  const base64 = (data.data as string).replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64");
}

// ── NEW: Generic Gmail search (per-card statement queries) ──
// Unlike listRelevantMessages() which hardcodes RELEVANT_SENDERS,
// this accepts an arbitrary Gmail search query string.
// Used by the credit-card fetch route for per-card subject/sender searches.
export async function searchMessages(
  accessToken: string,
  query: string,
  maxResults: number = 10
): Promise<GmailMessage[]> {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Gmail search failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return data.messages || [];
}

