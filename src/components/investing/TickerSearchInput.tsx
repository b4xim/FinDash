"use client";

// ============================================================
// TickerSearchInput — live Yahoo Finance symbol autocomplete
// for NSE/BSE stocks and ETFs.
// Type a company name (e.g. "Suzlon") → get SUZLON.NS
// Follows the same UX pattern as MFSearchInput.
// ============================================================

import { useState, useEffect, useRef } from "react";
import { Search, Check, Loader2, TrendingUp, Zap } from "lucide-react";
import type { TickerResult } from "@/app/api/ticker-search/route";

interface TickerSearchInputProps {
  onSelect:        (result: TickerResult) => void;
  selectedSymbol?: string;   // currently committed ticker, e.g. "SUZLON.NS"
  selectedName?:   string;   // currently committed name, e.g. "Suzlon Energy"
  assetType?:      "stock" | "etf"; // for placeholder hint
}

export default function TickerSearchInput({
  onSelect,
  selectedSymbol,
  selectedName,
  assetType = "stock",
}: TickerSearchInputProps) {
  const [query,   setQuery]   = useState("");
  const [results, setResults] = useState<TickerResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open,    setOpen]    = useState(false);
  const [error,   setError]   = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced search — fires 350 ms after typing stops
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2) {
      setResults([]);
      setError(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setError(false);
      try {
        const res  = await fetch(`/api/ticker-search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(Array.isArray(data) ? data : []);
      } catch {
        setError(true);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  function handleSelect(result: TickerResult) {
    onSelect(result);
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  const placeholder = assetType === "etf"
    ? "Search ETF name… e.g. Nifty 50, Nifty BeES"
    : "Search stock name… e.g. Suzlon, Reliance, HDFC Bank";

  return (
    <div className="relative">
      {/* Search box */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={selectedSymbol ? `${selectedSymbol} — change symbol` : placeholder}
          className="input pl-9 pr-9"
          autoComplete="off"
          spellCheck={false}
        />
        {loading && (
          <Loader2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-violet animate-spin pointer-events-none" />
        )}
      </div>

      {/* Selected ticker chip */}
      {selectedSymbol && !open && (
        <div className="flex items-center gap-2 mt-1.5">
          <div className="flex items-center gap-1.5 text-emerald-fin text-xs">
            <Check size={12} />
            <span className="font-mono font-medium">{selectedSymbol}</span>
          </div>
          {selectedName && (
            <span className="text-text-muted text-xs truncate">— {selectedName}</span>
          )}
          <Zap size={10} className="text-gold flex-shrink-0" />
        </div>
      )}

      {/* Dropdown results */}
      {open && results.length > 0 && (
        <div className="absolute z-20 mt-1 w-full max-h-72 overflow-y-auto bg-surface-overlay border border-white/10 rounded-xl shadow-card">
          {results.map(r => (
            <button
              key={r.symbol}
              type="button"
              onClick={() => handleSelect(r)}
              className="w-full text-left px-4 py-3 hover:bg-violet/10 transition-colors border-b border-white/5 last:border-0 group"
            >
              <div className="flex items-center justify-between gap-3">
                {/* Left: symbol + exchange badge */}
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-violet/15 flex items-center justify-center flex-shrink-0">
                    <TrendingUp size={13} className="text-violet-light" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-semibold text-text-primary text-sm group-hover:text-violet-light transition-colors">
                        {r.symbol}
                      </span>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                        r.exchange === "NSE"
                          ? "bg-emerald-fin/15 text-emerald-fin"
                          : "bg-amber-400/15 text-amber-400"
                      }`}>
                        {r.exchange}
                      </span>
                      {r.type === "ETF" && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-sky-500/15 text-sky-400 flex-shrink-0">
                          ETF
                        </span>
                      )}
                    </div>
                    <p className="text-text-muted text-xs truncate mt-0.5">{r.name}</p>
                  </div>
                </div>
                {/* Right: auto-sync hint */}
                <div className="flex items-center gap-1 text-text-muted text-[10px] flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Zap size={10} className="text-gold" /> auto-sync
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Empty state */}
      {open && query.trim().length >= 2 && !loading && !error && results.length === 0 && (
        <div className="absolute z-20 mt-1 w-full bg-surface-overlay border border-white/10 rounded-xl shadow-card px-4 py-4 text-center">
          <p className="text-text-muted text-sm">No matching NSE/BSE stocks found</p>
          <p className="text-text-muted text-xs mt-1">
            Try a different name, or enter the symbol manually below
          </p>
        </div>
      )}

      {/* Error state */}
      {open && error && (
        <div className="absolute z-20 mt-1 w-full bg-surface-overlay border border-white/10 rounded-xl shadow-card px-4 py-3">
          <p className="text-amber-400 text-xs">Search unavailable — enter symbol manually</p>
        </div>
      )}

      {/* Click-away to close */}
      {open && <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />}
    </div>
  );
}
