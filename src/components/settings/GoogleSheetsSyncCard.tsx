"use client";

// ============================================================
// GoogleSheetsSyncCard — Google Sheets one-click import card
// Used in the Settings page.
// ============================================================

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, CheckCircle2, AlertTriangle, FileSpreadsheet, Settings2 } from "lucide-react";

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

export default function GoogleSheetsSyncCard() {
  const [sheetsStatus, setSheetsStatus]   = useState<SheetsStatus | null>(null);
  const [sheetsLoading, setSheetsLoading] = useState(true);
  const [sheetsSyncing, setSheetsSyncing] = useState(false);
  const [sheetsResult, setSheetsResult]   = useState<SyncResult | null>(null);
  const [sheetsError, setSheetsError]     = useState<string | null>(null);

  const fetchSheetsStatus = useCallback(async () => {
    setSheetsLoading(true);
    const res = await fetch("/api/sheets-sync");
    setSheetsStatus(await res.json());
    setSheetsLoading(false);
  }, []);

  useEffect(() => {
    fetchSheetsStatus();
  }, [fetchSheetsStatus]);

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

  function fmtDate(iso: string | null) {
    if (!iso) return "Never";
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }

  return (
    <div>
      <h2 className="font-display font-semibold text-text-primary text-lg mb-3 flex items-center gap-2">
        <FileSpreadsheet size={18} className="text-emerald-400" />
        Google Sheets
      </h2>

      <div className="card p-6">
        {sheetsLoading ? (
          /* Loading skeleton */
          <div className="flex flex-wrap items-center justify-between gap-4 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-surface-elevated rounded-xl flex-shrink-0" />
              <div className="space-y-2">
                <div className="h-3.5 w-36 bg-surface-elevated rounded" />
                <div className="h-3 w-24 bg-surface-elevated rounded" />
              </div>
            </div>
            <div className="h-9 w-32 bg-surface-elevated rounded-xl" />
          </div>
        ) : sheetsStatus?.configured ? (
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
  );
}
