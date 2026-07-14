"use client";

// ============================================================
// Smart Picks Page — AI-powered stock & MF buy recommendations
// Uses Yahoo Finance + MFapi.in for data, Gemini for analysis
// ============================================================

import { useState, useEffect } from "react";
import Header from "@/components/layout/Header";
import SmartPicksGrid from "@/components/smart-picks/SmartPicksGrid";
import { SmartPick } from "@/types";
import { RefreshCw, Sparkles, AlertTriangle, Clock } from "lucide-react";

export default function SmartPicksPage() {
  const [picks, setPicks] = useState<SmartPick[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const storedPicks = localStorage.getItem("smartPicks_data");
      const storedRefreshedAt = localStorage.getItem("smartPicks_refreshedAt");
      if (storedPicks) {
        setPicks(JSON.parse(storedPicks));
      }
      if (storedRefreshedAt) {
        setRefreshedAt(storedRefreshedAt);
      }
    } catch (e) {
      console.error("Failed to load smart picks from localStorage", e);
    }
  }, []);

  async function handleRefresh() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/smart-picks");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch picks");
      }

      const data = await res.json();
      const newPicks = data.picks || [];
      setPicks(newPicks);
      setRefreshedAt(data.refreshedAt);

      // Save to localStorage
      try {
        localStorage.setItem("smartPicks_data", JSON.stringify(newPicks));
        if (data.refreshedAt) {
          localStorage.setItem("smartPicks_refreshedAt", data.refreshedAt);
        }
      } catch (e) {
        console.error("Failed to save smart picks to localStorage", e);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Header title="Smart Picks" subtitle="AI-powered buy recommendations" />

      <main className="flex-1 p-6 space-y-6 animate-fade-in">

        {/* Top bar: description + action */}
        <div className="card p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-violet flex items-center justify-center shadow-violet-glow flex-shrink-0">
                <Sparkles size={20} className="text-[#FFFFFF]" />
              </div>
              <div>
                <h2 className="font-display font-semibold text-text-primary">
                  AI Market Screener
                </h2>
                <p className="text-text-muted text-sm mt-0.5 max-w-lg">
                  Screens <strong className="text-text-secondary">Nifty 50</strong>, <strong className="text-text-secondary">Midcap 150</strong> &amp; <strong className="text-text-secondary">Smallcap 250</strong> for the top 3 stocks per segment,
                  then analyses each for risk &amp; return potential using Gemini AI.
                  All stocks &amp; ETFs are pre-screened for{" "}
                  <strong className="text-emerald-fin">Shariah compliance</strong>{" "}
                  (banks, insurance, tobacco, alcohol &amp; gambling excluded).
                  Mutual funds are not filtered.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-shrink-0">
              {refreshedAt && (
                <div className="flex items-center gap-1.5 text-text-muted text-xs">
                  <Clock size={12} />
                  <span>
                    {new Date(refreshedAt).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              )}
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="btn-primary flex items-center gap-2"
              >
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                {loading ? "Analyzing..." : "Refresh Picks"}
              </button>
            </div>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="card p-4 border-rose-fin/30 bg-rose-fin/5 flex items-center gap-3 animate-fade-in">
            <AlertTriangle size={18} className="text-rose-fin flex-shrink-0" />
            <p className="text-rose-fin text-sm">{error}</p>
          </div>
        )}

        {/* Picks grid */}
        <SmartPicksGrid picks={picks} loading={loading} />

        {/* Disclaimer */}
        <div className="card p-4 border-gold/20 bg-gold/5">
          <div className="flex items-start gap-3">
            <AlertTriangle size={16} className="text-gold flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-gold text-xs font-semibold uppercase tracking-wider mb-1">
                Disclaimer
              </p>
              <p className="text-text-secondary text-xs leading-relaxed">
                These recommendations are generated by AI for <strong>educational purposes only</strong>. 
                All stocks &amp; ETFs shown are pre-screened for Shariah compliance; mutual funds are listed without Shariah filtering. 
                This is not SEBI-registered financial advice, nor a certified Shariah ruling. Always do your own research and consult 
                a qualified financial advisor before making investment decisions. Past performance 
                does not guarantee future results.
              </p>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
