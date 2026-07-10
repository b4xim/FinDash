"use client";

// ============================================================
// WeeklyDigestCard — settings card to send the weekly email
// ============================================================

import { useState } from "react";
import { Mail, Send, CheckCircle, AlertTriangle } from "lucide-react";

export default function WeeklyDigestCard() {
  const [sending, setSending] = useState(false);
  const [result, setResult]   = useState<{ ok: boolean; message: string } | null>(null);

  async function handleSendNow() {
    setSending(true);
    setResult(null);
    try {
      const res  = await fetch("/api/weekly-digest");
      const data = await res.json();
      setResult(
        res.ok
          ? { ok: true,  message: `Sent · Week of ${data.week}` }
          : { ok: false, message: data.error || "Failed to send" }
      );
    } catch {
      setResult({ ok: false, message: "Network error — check server logs" });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="card p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-violet flex items-center justify-center shadow-violet-glow flex-shrink-0">
          <Mail size={16} className="text-white" />
        </div>
        <div>
          <p className="font-display font-medium text-text-primary">Weekly Digest Email</p>
          <p className="text-text-muted text-xs mt-0.5">Sends every Sunday at 8:00 AM IST</p>
        </div>
      </div>

      {/* Send button */}
      <button
        onClick={handleSendNow}
        disabled={sending}
        className="btn-primary flex items-center gap-2 w-full justify-center"
      >
        <Send size={14} className={sending ? "animate-pulse" : ""} />
        {sending ? "Sending…" : "Send Now"}
      </button>

      {/* Result banner */}
      {result && (
        <div
          className={`flex items-center gap-2 p-3 rounded-lg text-sm animate-fade-in border ${
            result.ok
              ? "bg-emerald-fin/8 border-emerald-fin/20 text-emerald-fin"
              : "bg-rose-fin/8 border-rose-fin/20 text-rose-fin"
          }`}
        >
          {result.ok
            ? <CheckCircle size={14} className="flex-shrink-0" />
            : <AlertTriangle size={14} className="flex-shrink-0" />}
          <span>{result.message}</span>
        </div>
      )}
    </div>
  );
}
