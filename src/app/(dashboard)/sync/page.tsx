"use client";

// ============================================================
// Sync Page — pull new emails from Gmail, review queue to
// approve/reject before anything is saved as a real transaction
// ============================================================

import { useState, useEffect, useCallback } from "react";
import Header from "@/components/layout/Header";
import PendingEmailCard from "@/components/sync/PendingEmailCard";
import { PendingEmail } from "@/types";
import { RefreshCw, Inbox, CheckCircle2, AlertTriangle, Mail } from "lucide-react";
import Link from "next/link";

interface GmailStatus {
  connected: boolean;
  email: string | null;
  lastSync: string | null;
}

export default function SyncPage() {
  const [gmailStatus, setGmailStatus] = useState<GmailStatus | null>(null);
  const [pendingEmails, setPendingEmails] = useState<PendingEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Fetch Gmail connection status
  const fetchStatus = useCallback(async () => {
    const res = await fetch("/api/gmail/status");
    const data = await res.json();
    setGmailStatus(data);
  }, []);

  // Fetch pending review queue
  const fetchPending = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/pending-emails");
    const data = await res.json();
    setPendingEmails(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchPending();
  }, [fetchStatus, fetchPending]);

  // Trigger a sync — pulls new emails since last sync
  async function handleSync() {
    setSyncing(true);
    setSyncMsg(null);
    setSyncError(null);

    const res = await fetch("/api/sync", { method: "POST" });
    const data = await res.json();

    if (!res.ok) {
      setSyncError(data.error || "Sync failed");
    } else {
      setSyncMsg(data.message);
      await fetchPending();
      await fetchStatus();
    }
    setSyncing(false);
  }

  // Approve a pending email — creates a real transaction
  async function handleApprove(id: string, data: Record<string, unknown>) {
    const res = await fetch(`/api/pending-emails/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      setPendingEmails(prev => prev.filter(e => e.id !== id));
    }
  }

  // Reject a pending email — no transaction created
  async function handleReject(id: string) {
    const res = await fetch(`/api/pending-emails/${id}/reject`, { method: "POST" });
    if (res.ok) {
      setPendingEmails(prev => prev.filter(e => e.id !== id));
    }
  }

  // ── Not connected state ──
  if (gmailStatus && !gmailStatus.connected) {
    return (
      <>
        <Header title="Sync" subtitle="Pull emails from Gmail" />
        <main className="flex-1 p-6 animate-fade-in">
          <div className="card p-12 text-center max-w-lg mx-auto">
            <div className="w-14 h-14 bg-violet/15 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Mail size={26} className="text-violet-light" />
            </div>
            <p className="font-display font-semibold text-text-primary text-lg">Gmail not connected</p>
            <p className="text-text-secondary text-sm mt-2 mb-6">
              Connect your Gmail account to automatically pull transaction and investment
              alert emails. Nothing is saved without your review.
            </p>
            <Link href="/settings" className="btn-primary inline-flex">
              Go to Settings to Connect
            </Link>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header title="Sync" subtitle="Pull emails from Gmail" />

      <main className="flex-1 p-6 space-y-6 animate-fade-in">
        {/* Connection + sync controls */}
        <div className="card p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-fin-dim rounded-xl flex items-center justify-center flex-shrink-0">
                <CheckCircle2 size={18} className="text-emerald-fin" />
              </div>
              <div>
                <p className="text-text-primary text-sm font-medium">Connected to {gmailStatus?.email}</p>
                <p className="text-text-muted text-xs mt-0.5">
                  Last synced: {gmailStatus?.lastSync ? new Date(gmailStatus.lastSync).toLocaleString("en-IN") : "Never"}
                </p>
              </div>
            </div>

            <button onClick={handleSync} disabled={syncing} className="btn-primary flex items-center gap-2">
              <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />
              {syncing ? "Syncing..." : "Sync Now"}
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
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-text-primary text-lg">Review Queue</h2>
            {pendingEmails.length > 0 && (
              <span className="badge-violet">{pendingEmails.length} waiting</span>
            )}
          </div>

          {loading ? (
            <div className="card p-12 text-center text-text-muted">Loading...</div>
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
        </div>
      </main>
    </>
  );
}
