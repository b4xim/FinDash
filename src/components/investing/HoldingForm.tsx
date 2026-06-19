"use client";

// ============================================================
// HoldingForm — shared form for Add and Edit holding modals
// Shows the MF search box only when asset_type === "mutual_fund"
// ============================================================

import { useState } from "react";
import { Holding, MFScheme } from "@/types";
import MFSearchInput from "./MFSearchInput";
import { Zap } from "lucide-react";

const ASSET_TYPES: { value: Holding["asset_type"]; label: string }[] = [
  { value: "mutual_fund", label: "Mutual Fund" },
  { value: "stock",       label: "Stock" },
  { value: "etf",         label: "ETF" },
  { value: "fd",          label: "Fixed Deposit" },
  { value: "ppf",         label: "PPF" },
  { value: "other",       label: "Other" },
];

interface HoldingFormProps {
  initial?: Partial<Holding>;
  onSubmit: (data: Partial<Holding>) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
}

export default function HoldingForm({ initial, onSubmit, onCancel, loading }: HoldingFormProps) {
  const [form, setForm] = useState({
    name:          initial?.name          ?? "",
    ticker:        initial?.ticker        ?? "",
    asset_type:    initial?.asset_type    ?? "mutual_fund" as Holding["asset_type"],
    units:         initial?.units         ?? "",
    buy_price:     initial?.buy_price     ?? "",
    current_price: initial?.current_price ?? "",
    account:       initial?.account       ?? "",
    notes:         initial?.notes         ?? "",
    mfapi_code:    initial?.mfapi_code    ?? "",
  });

  function set(field: string, value: string) {
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSubmit(form as Partial<Holding>);
  }

  const isMutualFund = form.asset_type === "mutual_fund";

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

      {/* Ticker — relevant for stocks/ETFs */}
      {!isMutualFund && (
        <div>
          <label className="label">Ticker <span className="text-text-muted">(optional)</span></label>
          <input
            type="text"
            value={form.ticker}
            onChange={e => set("ticker", e.target.value)}
            placeholder="e.g. RELIANCE, NIFTYBEES"
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

      {/* Current price — disabled hint for auto-synced mutual funds */}
      <div>
        <label className="label">
          Current Price (₹)
          {isMutualFund && form.mfapi_code && (
            <span className="text-emerald-fin text-xs font-normal ml-1.5">— will auto-update via NAV sync</span>
          )}
        </label>
        <input
          type="number"
          value={form.current_price}
          onChange={e => set("current_price", e.target.value)}
          placeholder={form.buy_price || "0.00"}
          min="0"
          step="0.01"
          className="input"
        />
        <p className="text-text-muted text-xs mt-1">
          {isMutualFund
            ? "Leave blank to use buy price initially — refresh prices later to fetch the real NAV."
            : "Update this manually whenever you check the latest price."}
        </p>
      </div>

      {/* Account */}
      <div>
        <label className="label">Account <span className="text-text-muted">(optional)</span></label>
        <input
          type="text"
          value={form.account}
          onChange={e => set("account", e.target.value)}
          placeholder="e.g. Zerodha, Groww, 5paisa"
          className="input"
        />
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
