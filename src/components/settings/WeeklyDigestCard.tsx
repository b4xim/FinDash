"use client";

// ============================================================
// WeeklyDigestCard — settings card to manage + test the weekly email
// ============================================================

import { useState } from "react";
import {
  Mail, Send, CheckCircle, AlertTriangle, Clock,
  ChevronDown, ChevronUp, Calendar,
} from "lucide-react";

export default function WeeklyDigestCard() {
  const [sending, setSending]   = useState(false);
  const [result, setResult]     = useState<{ ok: boolean; message: string } | null>(null);
  const [showSetup, setShowSetup] = useState(false);

  async function handleSendNow() {
    setSending(true);
    setResult(null);
    try {
      const cronSecret = ""; // client doesn't hold the secret — server will check session via cookie fallback
      const res = await fetch("/api/weekly-digest", {
        headers: cronSecret ? { Authorization: `Bearer ${cronSecret}` } : {},
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ ok: false, message: data.error || "Failed to send" });
      } else {
        setResult({
          ok: true,
          message: `Sent to ${data.recipient} · Week of ${data.week}`,
        });
      }
    } catch {
      setResult({ ok: false, message: "Network error — check server logs" });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="card p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-violet flex items-center justify-center shadow-violet-glow flex-shrink-0">
          <Mail size={18} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-display font-semibold text-text-primary">Weekly Digest Email</h2>
          <p className="text-text-muted text-sm mt-0.5">
            A branded summary of your spending, savings, portfolio &amp; budget — delivered every week.
          </p>
        </div>
      </div>

      {/* Schedule info */}
      <div className="flex items-center gap-3 p-3 rounded-lg bg-violet/5 border border-violet/15">
        <Calendar size={14} className="text-violet-light flex-shrink-0" />
        <div className="text-sm text-text-secondary leading-relaxed">
          <strong className="text-text-primary">Schedule:</strong> Every Sunday at 8:00 AM IST via{" "}
          <a
            href="https://cron-job.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-violet-light hover:underline"
          >
            cron-job.org
          </a>{" "}
          (free, no Vercel Pro needed)
        </div>
      </div>

      {/* What's included */}
      <div className="grid grid-cols-2 gap-2 text-xs text-text-muted">
        {[
          "📊 Week's income & spending",
          "🗂 Top spending categories",
          "💳 Biggest expenses",
          "📈 Portfolio value & gain/loss",
          "🚨 Budget alerts",
          "✨ Gemini AI financial insight",
        ].map(item => (
          <div key={item} className="flex items-center gap-1.5">
            <span>{item}</span>
          </div>
        ))}
      </div>

      {/* Send now button + result */}
      <div className="space-y-3">
        <button
          onClick={handleSendNow}
          disabled={sending}
          className="btn-primary flex items-center gap-2 w-full justify-center"
        >
          <Send size={15} className={sending ? "animate-pulse" : ""} />
          {sending ? "Sending..." : "Send Digest Now"}
        </button>

        {result && (
          <div
            className={`flex items-start gap-2.5 p-3 rounded-lg text-sm animate-fade-in border ${
              result.ok
                ? "bg-emerald-fin/8 border-emerald-fin/20 text-emerald-fin"
                : "bg-rose-fin/8 border-rose-fin/20 text-rose-fin"
            }`}
          >
            {result.ok ? (
              <CheckCircle size={15} className="flex-shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
            )}
            <span>{result.message}</span>
          </div>
        )}
      </div>

      {/* Setup instructions collapsible */}
      <div className="border-t border-white/5 pt-4">
        <button
          onClick={() => setShowSetup(v => !v)}
          className="flex items-center gap-2 text-xs text-text-muted hover:text-text-secondary transition-colors w-full"
        >
          <Clock size={12} />
          <span>Setup instructions for automatic weekly emails</span>
          {showSetup ? <ChevronUp size={12} className="ml-auto" /> : <ChevronDown size={12} className="ml-auto" />}
        </button>

        {showSetup && (
          <div className="mt-4 space-y-4 text-xs text-text-secondary leading-relaxed animate-fade-in">

            <div className="p-3 rounded-lg bg-white/3 border border-white/5 space-y-2">
              <p className="text-text-primary font-semibold text-[11px] uppercase tracking-wide">Step 1 · Get a Resend API key</p>
              <p>
                Sign up free at{" "}
                <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="text-violet-light hover:underline">
                  resend.com
                </a>
                . Go to <strong>API Keys → Create API Key</strong>. Add it to <code className="text-violet-light bg-violet/10 px-1 rounded">.env.local</code>:
              </p>
              <pre className="bg-navy-950 rounded p-2 text-[10px] text-emerald-fin overflow-x-auto">{`RESEND_API_KEY=re_your_key_here
WEEKLY_DIGEST_TO=you@youremail.com
CRON_SECRET=any_random_secret_string`}</pre>
            </div>

            <div className="p-3 rounded-lg bg-white/3 border border-white/5 space-y-2">
              <p className="text-text-primary font-semibold text-[11px] uppercase tracking-wide">Step 2 · (Optional) Verify your domain</p>
              <p>
                By default emails send from <code className="text-violet-light bg-violet/10 px-1 rounded">onboarding@resend.dev</code> which works for testing your own email.
                To send from <code className="text-violet-light bg-violet/10 px-1 rounded">digest@yourdomain.com</code>, verify your domain in Resend and update the <code className="text-violet-light bg-violet/10 px-1 rounded">from</code> field in the API route.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-white/3 border border-white/5 space-y-2">
              <p className="text-text-primary font-semibold text-[11px] uppercase tracking-wide">Step 3 · Schedule with cron-job.org (free)</p>
              <ol className="space-y-1.5 list-decimal list-inside">
                <li>Go to <a href="https://cron-job.org" target="_blank" rel="noopener noreferrer" className="text-violet-light hover:underline">cron-job.org</a> → Create cronjob</li>
                <li>URL: <code className="text-violet-light bg-violet/10 px-1 rounded">https://your-app.vercel.app/api/weekly-digest</code></li>
                <li>Schedule: <code className="text-violet-light bg-violet/10 px-1 rounded">Every Sunday at 08:00 IST</code></li>
                <li>
                  Add request header:{" "}
                  <code className="text-violet-light bg-violet/10 px-1 rounded">Authorization: Bearer your_CRON_SECRET</code>
                </li>
                <li>Save — done! ✅</li>
              </ol>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
