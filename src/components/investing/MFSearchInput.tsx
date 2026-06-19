"use client";

// ============================================================
// MFSearchInput — autocomplete search box for mutual fund schemes
// Calls /api/mf-search (debounced) and lets the user pick one,
// which auto-fills the scheme code for price auto-sync.
// ============================================================

import { useState, useEffect, useRef } from "react";
import { Search, Check, Loader2 } from "lucide-react";
import { MFScheme } from "@/types";

interface MFSearchInputProps {
  onSelect: (scheme: MFScheme) => void;
  selectedName?: string;
}

export default function MFSearchInput({ onSelect, selectedName }: MFSearchInputProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MFScheme[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced search — waits 400ms after typing stops before calling the API
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 3) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const res = await fetch(`/api/mf-search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
      setLoading(false);
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  function handleSelect(scheme: MFScheme) {
    onSelect(scheme);
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={selectedName || "Search e.g. HDFC Flexi Cap, Parag Parikh..."}
          className="input pl-9"
        />
        {loading && (
          <Loader2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-violet animate-spin" />
        )}
      </div>

      {/* Selected fund confirmation chip */}
      {selectedName && !open && (
        <div className="flex items-center gap-1.5 mt-1.5 text-emerald-fin text-xs">
          <Check size={12} /> Linked to: {selectedName}
        </div>
      )}

      {/* Dropdown results */}
      {open && results.length > 0 && (
        <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto bg-surface-overlay border border-white/10 rounded-xl shadow-card">
          {results.map(scheme => (
            <button
              key={scheme.schemeCode}
              type="button"
              onClick={() => handleSelect(scheme)}
              className="w-full text-left px-4 py-2.5 text-sm text-text-secondary hover:bg-violet/10 hover:text-text-primary transition-colors border-b border-white/5 last:border-0"
            >
              {scheme.schemeName}
            </button>
          ))}
        </div>
      )}

      {open && query.trim().length >= 3 && !loading && results.length === 0 && (
        <div className="absolute z-20 mt-1 w-full bg-surface-overlay border border-white/10 rounded-xl shadow-card px-4 py-3 text-text-muted text-sm">
          No matching schemes found
        </div>
      )}

      {/* Click-away overlay to close dropdown */}
      {open && (
        <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
      )}
    </div>
  );
}
