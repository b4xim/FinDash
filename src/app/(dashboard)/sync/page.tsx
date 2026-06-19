"use client";

// ============================================================
// Sync Page — two sync sources:
//   1. Google Sheets (Expenses tab) — one-click import
//   2. Gmail — pull transaction emails for review
// ============================================================

import { useState, useEffect, useCallback } from "react";
import Header from "@/components/layout/Header";
import PendingEmailCard from "@/components/sync/PendingEmailCard";
import { PendingEmail } from "@/types";
import {
  RefreshCw, Inbox, CheckCircle2, AlertTriangle,
  Mail, FileSpreadsheet, Settings2,
} from "lucide-react";
import Link from "next/link";

interface GmailStatus {
  connected: boolean;
  email: string | null;
  lastSync: string | null;
}

interface SheetsStatus {
  configured: boolean;
  lastSync: string | null;
}

interface SyncResult {
  inserted: number;
  updated: number;
  skipped: number;
  message: string;
  errors?: string[];
}

export default function SyncPage() {
  // ── Gmail state ─────────────────────────────────────────
  const [gmailStatus, setGmailStatus]    = useState<GmailStatus | null>(null);
  const [pendingEmails, setPendingEmails] = useState<PendingEmail[]>([]);
  const [loadingQueue, setLoadingQueue]  = useState(true);
  const [syncing, setSyncing]            = useState(false);
  const [syncMsg, setSyncMsg]            = useState<string | null>(null);
  const [syncError, setSyncError]        = useState<string | null>(null);

  // ── Sheets state ─────────────────────────────────────────
  const [sheetsStatus, setSheetsStatus]   = useState<SheetsStatus | null>(null);
  const [sheetsSyncing, setSheetsSyncing] = useState(false);
  const [sheetsResult, setSheetsResult]   = useState<SyncResult | null>(null);
  const [sheetsError, setSheetsError]     = useState<string | null>(null);

  // ── Data fetching ──────────────────────────────────────
  const fetchGmailStatus = useCallback(async () => {
    const res = await fetch("/api/gmail/status");
    setGmailStatus(await res.json());
  }, []);

  const fetchSheetsStatus = useCallback(async () => {
    const res = await fetch("/api/sheets-sync");
    setSheetsStatus(await res.json());
  }, []);

  const fetchPending = useCallback(async () => {
    setLoadingQueue(true);
    const res  = await fetch("/api/pending-emails");
    const data = await res.json();
    setPendingEmails(Array.isArray(data) ? data : []);
    setLoadingQueue(false);
  }, []);

  useEffect(() => {
    fetchGmailStatus();
    fetchSheetsStatus();
    fetchPending();
  }, [fetchGmailStatus, fetchSheetsStatus, fetchPending]);

  // ── Sheets sync ────────────────────────────────────────
  async function handleSheetsSync() {
    setSheetsSyncing(true);
    setSheetsResult(null);
    setSheetsError(null);
    const res  = await fetch("/api/sheets-sync", { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setSheetsError(data.error || "Sheets sync failed");
    } else {
      setSheetsResult(data);
      fetchSheetsStatus();
    }
    setSheetsSyncing(false);
  }

  // ── Gmail sync ─────────────────────────────────────────
  async function handleGmailSync() {
    setSyncing(true);
    setSyncMsg(null);
    setSyncError(null);
    const res  = await fetch("/api/sync", { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setSyncError(data.error || "Sync failed");
    } else {
      setSyncMsg(data.message);
      fetchPending();
      fetchGmailStatus();
    }
    setSyncing(false);
  }

  // ── Approve / Reject ───────────────────────────────────
  async function handleApprove(id: string, data: Record<string, unknown>) {
    const res = await fetch(`/api/pending-emails/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) setPendingEmails(prev => prev.filter(e => e.id !== id));
  }

  async function handleReject(id: string) {
    const res = await fetch(`/api/pending-emails/${id}/reject`, { method: "POST" });
    if (res.ok) setPendingEmails(prev => prev.filter(e => e.id !== id));
  }

  // ── Helpers ───────────────────────────────────────────
  function fmtDate(iso: string | null) {
    if (!iso) return "Never";
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }

  // ──────────────────────────────────────────────────────
  return (
    <>
      <Header title="Sync" subtitle="Import from Google Sheets & Gmail" />

      <main className="flex-1 p-6 space-y-8 animate-fade-in">

        {/* ── SECTION 1: Google Sheets ─────────────────── */}
        <div>
          <h2 className="font-display font-semibold text-text-primary text-lg mb-3 flex items-center gap-2">
            <FileSpreadsheet size={18} className="text-emerald-400" />
            Google Sheets
          </h2>

          <div className="card p-6">
            {sheetsStatus?.configured ? (
              /* Configured */
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <FileSpreadsheet size={18} className="text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-text-primary text-sm font-medium">Expenses sheet connected</p>
                    <p className="text-text-muted text-xs mt-0.5">
                      Last synced: {fmtDate(sheetsStatus.lastSync)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleSheetsSync}
                  disabled={sheetsSyncing}
                  className="btn-primary flex items-center gap-2"
                >
                  <RefreshCw size={16} className={sheetsSyncing ? "animate-spin" : ""} />
                  {sheetsSyncing ? "Syncing…" : "Sync from Sheets"}
                </button>
              </div>
            ) : (
              /* Not configured */
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Settings2 size={18} className="text-amber-400" />
                  </div>
                  <div>
                    <p className="text-text-primary text-sm font-medium">Sheets not configured</p>
                    <p className="text-text-muted text-xs mt-0.5 max-w-sm">
                      Add{" "}
                      <code className="text-violet-light bg-violet/10 px-1 rounded">SHEETS_WEBAPP_URL</code>
                      {" "}to your{" "}
                      <code className="text-violet-light bg-violet/10 px-1 rounded">.env.local</code>
                      {" "}and restart the dev server.
                    </p>
                  </div>
                </div>
                <span className="text-xs text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20">
                  Setup required
                </span>
              </div>
            )}

            {/* Result banner */}
            {sheetsResult && (
              <div className="mt-4 flex items-start gap-2 bg-emerald-fin-dim text-emerald-fin text-sm px-4 py-3 rounded-xl animate-fade-in">
                <CheckCircle2 size={15} className="mt-0.5 flex-shrink-0" />
                <div>
                  <p>{sheetsResult.message}</p>
                  {sheetsResult.errors && sheetsResult.errors.length > 0 && (
                    <ul className="mt-1 text-xs opacity-70 space-y-0.5 list-disc list-inside">
                      {sheetsResult.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  )}
                </div>
              </div>
            )}
            {sheetsError && (
              <div className="mt-4 flex items-center gap-2 bg-rose-fin-dim text-rose-fin text-sm px-4 py-2.5 rounded-xl animate-fade-in">
                <AlertTriangle size={15} className="flex-shrink-0" /> {sheetsError}
              </div>
            )}
          </div>
        </div>

        {/* ── SECTION 2: Gmail ─────────────────────────── */}
        <div>
          <h2 className="font-display font-semibold text-text-primary text-lg mb-3 flex items-center gap-2">
            <Mail size={18} className="text-violet-light" />
            Gmail
          </h2>

          {gmailStatus && !gmailStatus.connected ? (
            /* Gmail not connected */
            <div className="card p-10 text-center max-w-lg">
              <div className="w-14 h-14 bg-violet/15 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Mail size={26} className="text-violet-light" />
              </div>
              <p className="font-display font-semibold text-text-primary text-lg">Gmail not connected</p>
              <p className="text-text-secondary text-sm mt-2 mb-6">
                Connect your Gmail account to pull transaction and investment
                alert emails. Nothing is saved without your review.
              </p>
              <Link href="/settings" className="btn-primary inline-flex">
                Go to Settings to Connect
              </Link>
            </div>
          ) : (
            <>
              {/* Connected card */}
              <div className="card p-6 mb-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-fin-dim rounded-xl flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 size={18} className="text-emerald-fin" />
                    </div>
                    <div>
                      <p className="text-text-primary text-sm font-medium">
                        Connected to {gmailStatus?.email}
                      </p>
                      <p className="text-text-muted text-xs mt-0.5">
                        Last synced: {fmtDate(gmailStatus?.lastSync ?? null)}
                      </p>
                    </div>
                  </div>
                  <button onClick={handleGmailSync} disabled={syncing} className="btn-primary flex items-center gap-2">
                    <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />
                    {syncing ? "Syncing…" : "Sync Now"}
                  </button>
                </div>

                {syncMsg && (
                  <div className="mt-4 flex items-center gap-2 bg-emerald-fin-dim text-emerald-fin text-sm px-4 py-2.5 rounded-xl animate-fade-in">
                    <CheckCircle2 size={15} /> {syncMsg}
                  </div>
                )}
                {syncError && (
                  <div className="mt-4 flex items-center gap-2 bg-rose-fin-dim text-rose-fin text-sm px-4 py-2.5 rounded-xl animate-fade-in">
                    <AlertTriangle size={15} /> {syncError}
                  </div>
                )}
              </div>

              {/* Review queue */}
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display font-medium text-text-primary">Review Queue</h3>
                {pendingEmails.length > 0 && (
                  <span className="badge-violet">{pendingEmails.length} waiting</span>
                )}
              </div>

              {loadingQueue ? (
                <div className="card p-12 text-center text-text-muted animate-pulse">Loading…</div>
              ) : pendingEmails.length === 0 ? (
                <div className="card p-12 text-center">
                  <Inbox size={32} className="text-text-muted mx-auto mb-3" />
                  <p className="text-text-secondary">Nothing to review</p>
                  <p className="text-text-muted text-sm mt-1">
                    Click "Sync Now" to check for new transaction and investment emails
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingEmails.map(email => (
                    <PendingEmailCard
                      key={email.id}
                      email={email}
                      onApprove={handleApprove}
                      onReject={handleReject}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

      </main>
    </>
  );
}
