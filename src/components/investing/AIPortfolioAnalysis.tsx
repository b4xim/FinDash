"use client";

// ============================================================
// AIPortfolioAnalysis — Gemini-powered portfolio health panel
// Shows sell signals, add-more cues, category rebalancing,
// and strategic long-term advice for all current holdings.
// ============================================================

import { useState, useEffect } from "react";
import {
  Brain,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  Plus,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  Target,
  BarChart3,
  Lightbulb,
  ArrowUpRight,
  ArrowDownRight,
  X,
} from "lucide-react";
import type { PortfolioAnalysisResult, HoldingAnalysis, CategoryInsight } from "@/app/api/portfolio-analysis/route";

// ── Action styling helpers ─────────────────────────────────────

const ACTION_CONFIG: Record<
  HoldingAnalysis["action"],
  { label: string; colorClass: string; bgClass: string; icon: React.ReactNode }
> = {
  "Hold": {
    label: "Hold",
    colorClass: "text-text-secondary",
    bgClass: "bg-white/5",
    icon: <Minus size={12} />,
  },
  "Add More": {
    label: "Add More",
    colorClass: "text-emerald-fin",
    bgClass: "bg-emerald-fin/10",
    icon: <Plus size={12} />,
  },
  "Sell": {
    label: "Sell",
    colorClass: "text-rose-fin",
    bgClass: "bg-rose-fin/10",
    icon: <TrendingDown size={12} />,
  },
  "Trim": {
    label: "Trim",
    colorClass: "text-amber-400",
    bgClass: "bg-amber-400/10",
    icon: <ArrowDownRight size={12} />,
  },
  "Reduce": {
    label: "Reduce",
    colorClass: "text-orange-400",
    bgClass: "bg-orange-400/10",
    icon: <ArrowDownRight size={12} />,
  },
};

const URGENCY_CONFIG: Record<
  HoldingAnalysis["urgency"],
  { dot: string; label: string }
> = {
  High:   { dot: "bg-rose-fin",   label: "High Priority" },
  Medium: { dot: "bg-amber-400",  label: "Medium Priority" },
  Low:    { dot: "bg-emerald-fin", label: "Low Priority" },
};

const GAP_CONFIG: Record<
  CategoryInsight["gap"],
  { colorClass: string; icon: React.ReactNode; label: string }
> = {
  Over:     { colorClass: "text-rose-fin",    icon: <ArrowUpRight size={14} />,   label: "Over-weight" },
  Under:    { colorClass: "text-amber-400",   icon: <ArrowDownRight size={14} />, label: "Under-weight" },
  Balanced: { colorClass: "text-emerald-fin", icon: <CheckCircle size={14} />,    label: "Balanced" },
};

const ASSET_LABELS: Record<string, string> = {
  mutual_fund: "Mutual Funds",
  stock: "Stocks",
  etf: "ETFs",
  fd: "Fixed Deposits",
  ppf: "PPF",
  other: "Other",
};

// ── Score ring visual ──────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const pct = (score / 10) * 100;
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const strokeDash = (pct / 100) * circumference;
  const scoreColor =
    score >= 8 ? "#10b981" : score >= 5 ? "#f59e0b" : "#f43f5e";

  return (
    <div className="relative w-28 h-28 flex-shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
        <circle
          cx="50" cy="50" r={radius}
          fill="none"
          stroke={scoreColor}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${strokeDash} ${circumference}`}
          className="transition-all duration-1000 ease-out"
          style={{ filter: `drop-shadow(0 0 6px ${scoreColor}80)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-display font-bold text-text-primary">{score}</span>
        <span className="text-[10px] text-text-muted uppercase tracking-wider">/10</span>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────

export default function AIPortfolioAnalysis() {
  const [analysis, setAnalysis] = useState<PortfolioAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<"holdings" | "categories" | "strategy">("holdings");

  useEffect(() => {
    try {
      const storedAnalysis = localStorage.getItem("aiPortfolioAnalysis_data");
      if (storedAnalysis) {
        setAnalysis(JSON.parse(storedAnalysis));
      }
    } catch (e) {
      console.error("Failed to load portfolio analysis from localStorage", e);
    }
  }, []);

  async function handleAnalyse() {
    setLoading(true);
    setError(null);
    setAnalysis(null);
    setExpanded(true);

    try {
      const res = await fetch("/api/portfolio-analysis", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Analysis failed — please try again.");
      } else {
        setAnalysis(data as PortfolioAnalysisResult);
        setActiveTab("holdings");
        
        try {
          localStorage.setItem("aiPortfolioAnalysis_data", JSON.stringify(data));
        } catch (e) {
          console.error("Failed to save portfolio analysis to localStorage", e);
        }
      }
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  // Sort holding recommendations: High urgency first, then by action priority
  const ACTION_PRIORITY: Record<string, number> = { Sell: 0, Trim: 1, Reduce: 2, "Add More": 3, Hold: 4 };
  const sortedHoldings = analysis
    ? [...analysis.holdingRecommendations].sort((a, b) => {
        const urgencyDiff = (a.urgency === "High" ? 0 : a.urgency === "Medium" ? 1 : 2) -
                            (b.urgency === "High" ? 0 : b.urgency === "Medium" ? 1 : 2);
        if (urgencyDiff !== 0) return urgencyDiff;
        return (ACTION_PRIORITY[a.action] ?? 5) - (ACTION_PRIORITY[b.action] ?? 5);
      })
    : [];

  return (
    <div className="card overflow-hidden">
      {/* ── Header / Trigger ───────────────────────────── */}
      <div className="p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-violet-500/20 to-purple-600/20 border border-violet/20">
            <Brain size={20} className="text-violet-light" />
          </div>
          <div>
            <p className="font-display font-medium text-text-primary flex items-center gap-2">
              AI Portfolio Analyser
              <Sparkles size={14} className="text-gold" />
            </p>
            <p className="text-text-muted text-sm">
              {analysis
                ? `Last analysed: ${new Date(analysis.analysedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`
                : "Get personalised sell signals, rebalancing tips & more"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {analysis && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="btn-ghost p-2 flex items-center gap-1 text-sm"
            >
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              {expanded ? "Collapse" : "Expand"}
            </button>
          )}
          <button
            onClick={handleAnalyse}
            disabled={loading}
            className="btn-primary flex items-center gap-2 whitespace-nowrap"
            style={{
              background: loading
                ? undefined
                : "linear-gradient(135deg, #7c3aed, #9d4edd)",
              boxShadow: loading ? undefined : "0 0 20px rgba(124, 58, 237, 0.3)",
            }}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Analysing...
              </>
            ) : (
              <>
                <Brain size={16} />
                {analysis ? "Re-Analyse" : "Analyse Portfolio"}
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Loading state ──────────────────────────────── */}
      {loading && (
        <div className="px-6 pb-6 animate-fade-in">
          <div className="rounded-xl border border-violet/20 bg-violet/5 p-6 text-center space-y-3">
            <div className="flex justify-center">
              <div className="w-12 h-12 rounded-full bg-violet/10 border border-violet/30 flex items-center justify-center">
                <Brain size={24} className="text-violet-light animate-pulse" />
              </div>
            </div>
            <p className="text-text-primary font-medium">AI is reviewing your portfolio…</p>
            <p className="text-text-muted text-sm">
              Analysing holdings, allocation, gain/loss ratios, and building personalised recommendations.
              This may take 10–20 seconds.
            </p>
            <div className="flex justify-center gap-1 pt-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full bg-violet-light animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Error state ────────────────────────────────── */}
      {error && !loading && (
        <div className="px-6 pb-6 animate-fade-in">
          <div className="rounded-xl border border-rose-fin/30 bg-rose-fin/5 p-4 flex items-start gap-3">
            <AlertTriangle size={18} className="text-rose-fin mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-rose-fin font-medium text-sm">Analysis failed</p>
              <p className="text-text-muted text-sm mt-0.5">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="ml-auto text-text-muted hover:text-text-secondary">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── Results ────────────────────────────────────── */}
      {analysis && expanded && !loading && (
        <div className="animate-fade-in">
          {/* ── Overview strip ── */}
          <div className="mx-6 mb-5 rounded-2xl border border-white/5 bg-surface-overlay p-5">
            <div className="flex flex-col sm:flex-row gap-5 items-start">
              <ScoreRing score={analysis.overallScore} />

              <div className="flex-1 space-y-3">
                <div className="flex flex-wrap gap-2">
                  <span className="badge-violet">{analysis.riskProfile} Risk</span>
                  {analysis.topActions.slice(0, 1).map((a, i) => (
                    <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-400">
                      ⚡ {a}
                    </span>
                  ))}
                </div>

                <p className="text-text-primary text-sm leading-relaxed">{analysis.overallSummary}</p>

                <p className="text-text-muted text-xs leading-relaxed italic border-l-2 border-violet/30 pl-3">
                  {analysis.diversificationComment}
                </p>
              </div>
            </div>
          </div>

          {/* ── Top action items ── */}
          {analysis.topActions.length > 0 && (
            <div className="mx-6 mb-5">
              <p className="text-text-muted text-xs font-medium uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Target size={12} /> Immediate Action Items
              </p>
              <div className="space-y-1.5">
                {analysis.topActions.map((action, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2.5 text-sm text-text-secondary py-1.5 px-3 rounded-lg bg-white/[0.02] border border-white/5"
                  >
                    <span className="w-5 h-5 rounded-full bg-violet/20 text-violet-light text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    {action}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Tab navigation ── */}
          <div className="px-6 mb-4 flex gap-1 border-b border-white/5">
            {(["holdings", "categories", "strategy"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors capitalize ${
                  activeTab === tab
                    ? "text-violet-light border-b-2 border-violet-light -mb-px bg-violet/5"
                    : "text-text-muted hover:text-text-secondary"
                }`}
              >
                {tab === "holdings" && <span className="flex items-center gap-1.5"><TrendingUp size={13} /> Holdings</span>}
                {tab === "categories" && <span className="flex items-center gap-1.5"><BarChart3 size={13} /> Allocation</span>}
                {tab === "strategy" && <span className="flex items-center gap-1.5"><Lightbulb size={13} /> Strategy</span>}
              </button>
            ))}
          </div>

          {/* ── Holdings tab ── */}
          {activeTab === "holdings" && (
            <div className="px-6 pb-6 space-y-3">
              {sortedHoldings.length === 0 ? (
                <p className="text-text-muted text-sm text-center py-6">No holding recommendations generated.</p>
              ) : (
                sortedHoldings.map((rec) => {
                  const actionCfg = ACTION_CONFIG[rec.action] ?? ACTION_CONFIG["Hold"];
                  const urgencyCfg = URGENCY_CONFIG[rec.urgency];

                  return (
                    <div
                      key={rec.holdingId}
                      className="rounded-xl border border-white/5 bg-white/[0.02] p-4 hover:border-white/10 transition-colors"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${actionCfg.colorClass} ${actionCfg.bgClass}`}
                          >
                            {actionCfg.icon}
                            {rec.action}
                          </span>
                          <span className="font-medium text-text-primary text-sm truncate">{rec.name}</span>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          {rec.suggestedQtyChange && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-text-secondary font-mono">
                              {rec.suggestedQtyChange}
                            </span>
                          )}
                          <div className="flex items-center gap-1.5">
                            <div className={`w-1.5 h-1.5 rounded-full ${urgencyCfg.dot}`} />
                            <span className="text-[10px] text-text-muted">{urgencyCfg.label}</span>
                          </div>
                        </div>
                      </div>

                      <p className="text-text-secondary text-xs mt-2.5 leading-relaxed">{rec.reason}</p>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ── Categories tab ── */}
          {activeTab === "categories" && (
            <div className="px-6 pb-6 space-y-3">
              {analysis.categoryInsights.length === 0 ? (
                <p className="text-text-muted text-sm text-center py-6">No allocation data available.</p>
              ) : (
                analysis.categoryInsights.map((ci) => {
                  const gapCfg = GAP_CONFIG[ci.gap];
                  const barWidth = Math.min(ci.currentPct, 100);

                  return (
                    <div
                      key={ci.category}
                      className="rounded-xl border border-white/5 bg-white/[0.02] p-4 hover:border-white/10 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-text-primary">
                            {ASSET_LABELS[ci.category] ?? ci.category}
                          </span>
                          <span className={`flex items-center gap-0.5 text-xs ${gapCfg.colorClass}`}>
                            {gapCfg.icon}
                            {gapCfg.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-text-muted">
                          <span>Current: <span className="text-text-secondary font-mono">{ci.currentPct}%</span></span>
                          <span>·</span>
                          <span>Target: <span className="text-text-secondary font-mono">{ci.recommendedPct}</span></span>
                        </div>
                      </div>

                      {/* Weight bar */}
                      <div className="h-1.5 rounded-full bg-white/5 mb-3 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${barWidth}%`,
                            background:
                              ci.gap === "Balanced"
                                ? "#10b981"
                                : ci.gap === "Over"
                                ? "#f43f5e"
                                : "#f59e0b",
                          }}
                        />
                      </div>

                      <p className="text-text-muted text-xs leading-relaxed">{ci.advice}</p>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ── Strategy tab ── */}
          {activeTab === "strategy" && (
            <div className="px-6 pb-6 space-y-4">
              <div className="rounded-xl border border-violet/20 bg-violet/5 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-violet/20 flex items-center justify-center">
                    <Lightbulb size={15} className="text-violet-light" />
                  </div>
                  <p className="font-medium text-text-primary text-sm">Long-Term Strategy</p>
                </div>
                <p className="text-text-secondary text-sm leading-relaxed">{analysis.longTermAdvice}</p>
              </div>

              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5 space-y-2">
                <p className="text-text-muted text-xs font-medium uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <CheckCircle size={12} /> All Action Items
                </p>
                {analysis.topActions.map((action, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-violet/20 text-violet-light text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <p className="text-text-secondary text-sm leading-relaxed">{action}</p>
                  </div>
                ))}
              </div>

              <p className="text-text-muted text-[11px] text-center leading-relaxed px-2">
                ⚠️ AI-generated suggestions are for informational purposes only and not financial advice.
                Please consult a SEBI-registered advisor before making investment decisions.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
