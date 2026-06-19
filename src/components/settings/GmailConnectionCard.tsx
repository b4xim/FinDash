"use client";

// ============================================================
// GmailConnectionCard — connect/disconnect Gmail for email sync
// ============================================================

import { useState, useEffect, useCallback } from "react";
import { Mail, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

interface GmailStatus {
  connected: boolean;
  email: string | null;
  lastSync: string | null;
}

export default function GmailConnectionCard() {
  const [status, setStatus] = useState<GmailStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/gmail/status");
    const data = await res.json();
    setStatus(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Initiates the Google OAuth flow — NextAuth handles the redirect
  function handleConnect() {
    window.location.href = "/api/auth/signin/google?callbackUrl=/settings";
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    await fetch("/api/gmail/disconnect", { method: "POST" });
    setShowConfirm(false);
    setDisconnecting(false);
    await fetchStatus();
  }

  return (
    <div className="card p-6">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-9 h-9 bg-violet/15 rounded-xl flex items-center justify-center flex-shrink-0">
          <Mail size={16} className="text-violet-light" />
        </div>
        <div>
          <p className="font-display font-medium text-text-primary">Gmail Connection</p>
          <p className="text-text-muted text-xs">Used only to read transaction & investment emails (read-only)</p>
        </div>
      </div>

      <div className="mt-5">
        {loading ? (
          <div className="flex items-center gap-2 text-text-muted text-sm">
            <Loader2 size={14} className="animate-spin" /> Checking connection...
          </div>
        ) : status?.connected ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={18} className="text-emerald-fin flex-shrink-0" />
              <div>
                <p className="text-text-primary text-sm font-medium">{status.email}</p>
                <p className="text-text-muted text-xs mt-0.5">
                  Last synced: {status.lastSync ? new Date(status.lastSync).toLocaleString("en-IN") : "Never"}
                </p>
              </div>
            </div>
            <button onClick={() => setShowConfirm(true)} className="btn-danger text-sm">
              Disconnect
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <XCircle size={18} className="text-text-muted flex-shrink-0" />
              <p className="text-text-secondary text-sm">Not connected</p>
            </div>
            <button onClick={handleConnect} className="btn-primary text-sm">
              Connect Gmail
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={showConfirm}
        title="Disconnect Gmail?"
        message="This revokes access and stops automatic email syncing. Transactions already saved won't be affected. You can reconnect anytime."
        confirmLabel={disconnecting ? "Disconnecting..." : "Disconnect"}
        danger
        onConfirm={handleDisconnect}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
}
