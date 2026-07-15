"use client";

// ============================================================
// HoldingForm — shared form for Add and Edit holding modals
// - Mutual Fund: shows MFSearchInput, auto-fills name + mfapi_code
// - Stock/ETF: shows a Symbol field (NSE .NS suffix) for Yahoo Finance sync
// - FD/PPF/Other: plain optional reference field, no auto-sync
// ============================================================

import { useState } from "react";
import { Holding, MFScheme } from "@/types";
import MFSearchInput from "./MFSearchInput";
import TickerSearchInput from "./TickerSearchInput";
import type { TickerResult } from "@/app/api/ticker-search/route";
import { Zap, Info } from "lucide-react";
import { formatINR } from "@/lib/utils";

const ASSET_TYPES: { value: Holding["asset_type"]; label: string }[] = [
  { value: "mutual_fund", label: "Mutual Fund" },
  { value: "stock",       label: "Stock" },
  { value: "etf",         label: "ETF" },
  { value: "fd",          label: "Fixed Deposit" },
  { value: "ppf",         label: "PPF" },
  { value: "other",       label: "Other" },
];

const ACCOUNT_OPTIONS = [
  "Zerodha",
  "Groww",
  "Angel One",
  "Upstox",
  "5paisa",
  "HDFC Securities",
  "ICICI Direct",
  "Kotak Securities",
  "Motilal Oswal",
  "Paytm Money",
  "ET Money",
  "INDmoney",
  "SBI Securities",
  "Axis Direct",
  "Kuvera",
  "MFCentral",
];

interface FormState {
  name: string;
  ticker: string;
  asset_type: Holding["asset_type"];
  units: string;
  buy_price: string;
  current_price: string;
  account: string;
  notes: string;
  mfapi_code: string;
}

interface HoldingFormProps {
  initial?: Partial<Holding>;
  /** Pass the current holdings list to enable duplicate/merge detection */
  existingHoldings?: Holding[];
  onSubmit: (data: Partial<Holding>) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
}

export default function HoldingForm({ initial, existingHoldings = [], onSubmit, onCancel, loading }: HoldingFormProps) {
  const [form, setForm] = useState<FormState>({
    name:          initial?.name ?? "",
    ticker:        initial?.ticker ?? "",
    asset_type:    initial?.asset_type ?? "mutual_fund",
    units:         initial?.units?.toString() ?? "",
    buy_price:     initial?.buy_price?.toString() ?? "",
    current_price: initial?.current_price?.toString() ?? "",
    account:       initial?.account ?? "",
    notes:         initial?.notes ?? "",
    mfapi_code:    initial?.mfapi_code ?? "",
  });

  function set(field: keyof FormState, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  // When a mutual fund is picked from search, auto-fill name + scheme code
  function handleMFSelect(scheme: MFScheme) {
    setForm(prev => ({
      ...prev,
      name: scheme.schemeName,
      mfapi_code: String(scheme.schemeCode),
    }));
  }

  // When a stock/ETF ticker is selected from Yahoo Finance search,
  // auto-fill the symbol (ticker) AND the holding name
  function handleTickerSelect(result: TickerResult) {
    setForm(prev => ({
      ...prev,
      ticker: result.symbol,
      // Only overwrite name if the user hasn't filled it in yet
      name: prev.name || result.name,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const parseNumberField = (value: string) => {
      const parsed = parseFloat(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    };

    const payload: Partial<Holding> = {
      name: form.name || undefined,
      ticker: form.ticker || undefined,
      asset_type: form.asset_type,
      units: parseNumberField(form.units),
      buy_price: parseNumberField(form.buy_price),
      current_price: parseNumberField(form.current_price),
      account: form.account || undefined,
      notes: form.notes || undefined,
      mfapi_code: form.mfapi_code || undefined,
    };

    await onSubmit(payload);
  }

  const isMutualFund = form.asset_type === "mutual_fund";

  // Detect if a same-name + same-type holding already exists (only in Add mode)
  const duplicateMatch = !initial?.id
    ? existingHoldings.find(
        (h) =>
          h.name.trim().toLowerCase() === form.name.trim().toLowerCase() &&
          h.asset_type === form.asset_type
      )
    : undefined;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Asset type — picked first since it changes the form below */}
      <div>
        <label className="label">Asset Type</label>
        <select
          value={form.asset_type}
          onChange={e => set("asset_type", e.target.value)}
          className="select"
          required
        >
          {ASSET_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      {/* Mutual fund search — only shown for mutual_fund type */}
      {isMutualFund ? (
        <div>
          <label className="label flex items-center gap-1.5">
            Fund Name <Zap size={12} className="text-gold" />
            <span className="text-text-muted font-normal text-xs">(auto-syncs NAV)</span>
          </label>
          <MFSearchInput onSelect={handleMFSelect} selectedName={form.name} />
          {/* Allow manual override of name even after picking */}
          {form.name && (
            <input
              type="text"
              value={form.name}
              onChange={e => set("name", e.target.value)}
              className="input mt-2 text-xs"
              placeholder="Fund name"
            />
          )}
        </div>
      ) : (
        <div>
          <label className="label">Name</label>
          <input
            type="text"
            value={form.name}
            onChange={e => set("name", e.target.value)}
            placeholder="e.g. Reliance Industries, Nifty 50 ETF"
            className="input"
            required
          />
        </div>
      )}

      {/* Duplicate / merge warning */}
      {duplicateMatch && (
        <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-gold/10 border border-gold/30 animate-fade-in">
          <Info size={14} className="text-gold flex-shrink-0 mt-0.5" />
          <p className="text-gold text-xs leading-relaxed">
            <strong>Existing holding found.</strong> Submitting will{" "}
            <strong>add {form.units || "N"} units</strong> to your current{" "}
            {duplicateMatch.units.toLocaleString("en-IN")} units and recalculate a{" "}
            <strong>weighted avg buy price</strong> from the current{" "}
            {formatINR(duplicateMatch.buy_price)}.
          </p>
        </div>
      )}


      {!isMutualFund && (form.asset_type === "stock" || form.asset_type === "etf") && (
        <div>
          <label className="label flex items-center gap-1.5">
            Symbol
            <Zap size={12} className="text-gold" />
            <span className="text-text-muted font-normal text-xs">(auto-syncs price)</span>
          </label>

          {/* Live search — type company name to get symbol suggestions */}
          <TickerSearchInput
            onSelect={handleTickerSelect}
            selectedSymbol={form.ticker || undefined}
            selectedName={form.name || undefined}
            assetType={form.asset_type as "stock" | "etf"}
          />

          {/* Manual override: still allow typing symbol directly */}
          <div className="mt-2">
            <input
              type="text"
              value={form.ticker}
              onChange={e => set("ticker", e.target.value.toUpperCase())}
              placeholder="Or type symbol directly — e.g. RELIANCE.NS"
              className="input text-xs font-mono"
            />
            <p className="text-text-muted text-xs mt-1">
              Search above to auto-fill, or type the NSE symbol with .NS suffix manually. Leave blank for manual price entry.
            </p>
          </div>
        </div>
      )}

      {/* Ticker — optional free text for FD/PPF/Other, no auto-sync */}
      {!isMutualFund && form.asset_type !== "stock" && form.asset_type !== "etf" && (
        <div>
          <label className="label">Ticker / Reference <span className="text-text-muted">(optional)</span></label>
          <input
            type="text"
            value={form.ticker}
            onChange={e => set("ticker", e.target.value)}
            placeholder="e.g. account or certificate number"
            className="input"
          />
        </div>
      )}

      {/* Units + Buy price */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Units</label>
          <input
            type="number"
            value={form.units}
            onChange={e => set("units", e.target.value)}
            placeholder="0"
            min="0"
            step="0.0001"
            className="input"
            required
          />
        </div>
        <div>
          <label className="label">Avg Buy Price (₹)</label>
          <input
            type="number"
            value={form.buy_price}
            onChange={e => set("buy_price", e.target.value)}
            placeholder="0.00"
            min="0"
            step="0.01"
            className="input"
            required
          />
        </div>
      </div>

      {/* Current price — hint changes based on whether this holding will auto-sync */}
      <div>
        <label className="label">
          Current Price (₹)
          {isMutualFund && form.mfapi_code && (
            <span className="text-emerald-fin text-xs font-normal ml-1.5">— will auto-update via NAV sync</span>
          )}
          {!isMutualFund && (form.asset_type === "stock" || form.asset_type === "etf") && form.ticker && (
            <span className="text-emerald-fin text-xs font-normal ml-1.5">— will auto-update via Yahoo Finance</span>
          )}
        </label>
        <input
          type="number"
          value={form.current_price}
          onChange={e => set("current_price", e.target.value)}
          placeholder={form.buy_price !== "" ? form.buy_price : "0.00"}
          min="0"
          step="0.01"
          className="input"
        />
        <p className="text-text-muted text-xs mt-1">
          {isMutualFund
            ? "Leave blank to use buy price initially — refresh prices later to fetch the real NAV."
            : form.ticker && (form.asset_type === "stock" || form.asset_type === "etf")
            ? "Leave blank to use buy price initially — refresh prices later to fetch the real quote."
            : "Update this manually whenever you check the latest price."}
        </p>
      </div>

      {/* Account */}
      <div>
        <label className="label">Account <span className="text-text-muted">(optional)</span></label>
        <select
          className="select"
          value={ACCOUNT_OPTIONS.includes(form.account) ? form.account : (form.account ? "Other" : "")}
          onChange={e => {
            if (e.target.value === "Other") set("account", "");
            else set("account", e.target.value);
          }}
        >
          <option value="">— Select broker / account —</option>
          {ACCOUNT_OPTIONS.map(a => (
            <option key={a} value={a}>{a}</option>
          ))}
          <option value="Other">Other…</option>
        </select>
        {/* Free-text fallback when "Other" or custom value */}
        {form.account !== "" && !ACCOUNT_OPTIONS.includes(form.account) && (
          <input
            type="text"
            value={form.account}
            onChange={e => set("account", e.target.value)}
            placeholder="Type broker / account name"
            className="input mt-1.5 text-sm"
          />
        )}
      </div>

      {/* Notes */}
      <div>
        <label className="label">Notes <span className="text-text-muted">(optional)</span></label>
        <textarea
          value={form.notes}
          onChange={e => set("notes", e.target.value)}
          className="input resize-none"
          rows={2}
        />
      </div>

      {/* Buttons */}
      <div className="flex gap-3 justify-end pt-1">
        <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Saving..." : initial?.id ? "Save Changes" : "Add Holding"}
        </button>
      </div>
    </form>
  );
}
