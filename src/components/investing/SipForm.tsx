"use client";

// ============================================================
// SipForm — Add / Edit SIP mandate modal form
// Supports: mutual_fund (MF search), etf, stock (Ticker search)
// Includes: "Link to Holding" dropdown with auto-match + auto-create
// ============================================================

import { useState, useEffect } from "react";
import { SipEntry, SipAssetType, SipFrequency, MFScheme, Holding } from "@/types";
import MFSearchInput from "./MFSearchInput";
import TickerSearchInput from "./TickerSearchInput";
import type { TickerResult } from "@/app/api/ticker-search/route";
import { Zap, CalendarDays, Link2, AlertCircle, CheckCircle2, XCircle } from "lucide-react";

const SIP_ASSET_TYPES: { value: SipAssetType; label: string }[] = [
  { value: "mutual_fund", label: "Mutual Fund" },
  { value: "etf",         label: "ETF" },
  { value: "stock",       label: "Stock" },
];

const FREQUENCY_OPTIONS: { value: SipFrequency; label: string }[] = [
  { value: "monthly",    label: "Monthly" },
  { value: "weekly",     label: "Weekly" },
  { value: "quarterly",  label: "Quarterly" },
];

const ACCOUNT_OPTIONS = [
  "Zerodha", "Groww", "Angel One", "Upstox", "5paisa",
  "HDFC Securities", "ICICI Direct", "Kotak Securities",
  "Motilal Oswal", "Paytm Money", "ET Money", "INDmoney",
  "SBI Securities", "Axis Direct", "Kuvera", "MFCentral",
];

interface FormState {
  name: string;
  asset_type: SipAssetType;
  sip_amount: string;
  frequency: SipFrequency;
  sip_date: string;
  start_date: string;
  end_date: string;
  total_installments_done: string;
  total_invested: string;
  account: string;
  mfapi_code: string;
  ticker: string;
  notes: string;
  // Holding link
  holding_id: string;
  auto_create_holding: boolean;
}

interface SipFormProps {
  initial?: Partial<SipEntry>;
  holdings?: Holding[]; // passed from page to populate the link dropdown
  onSubmit: (data: Partial<SipEntry> & {
    auto_match_holding?: boolean;
    auto_create_holding?: boolean;
  }) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
}

export default function SipForm({ initial, holdings = [], onSubmit, onCancel, loading }: SipFormProps) {
  const today = new Date().toISOString().split("T")[0];
  const isEditing = !!initial?.id;

  const [validationError, setValidationError] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>({
    name:                    initial?.name ?? "",
    asset_type:              initial?.asset_type ?? "mutual_fund",
    sip_amount:              initial?.sip_amount?.toString() ?? "",
    frequency:               initial?.frequency ?? "monthly",
    sip_date:                initial?.sip_date?.toString() ?? "1",
    start_date:              initial?.start_date ?? today,
    end_date:                initial?.end_date ?? "",
    total_installments_done: initial?.total_installments_done?.toString() ?? "0",
    total_invested:          initial?.total_invested?.toString() ?? "0",
    account:                 initial?.account ?? "",
    mfapi_code:              initial?.mfapi_code ?? "",
    ticker:                  initial?.ticker ?? "",
    notes:                   initial?.notes ?? "",
    holding_id:              initial?.holding_id ?? "",
    auto_create_holding:     false,
  });

  function set<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  // Auto-match holding when mfapi_code or ticker is set
  useEffect(() => {
    if (isEditing) return;
    if (form.mfapi_code) {
      const match = holdings.find(h => h.mfapi_code === form.mfapi_code);
      if (match) set("holding_id", match.id);
    } else if (form.ticker) {
      const match = holdings.find(h => h.ticker === form.ticker);
      if (match) set("holding_id", match.id);
    }
  }, [form.mfapi_code, form.ticker]);

  function handleMFSelect(scheme: MFScheme) {
    setForm(prev => ({
      ...prev,
      name: scheme.schemeName,
      mfapi_code: String(scheme.schemeCode),
    }));
  }

  function handleTickerSelect(result: TickerResult) {
    setForm(prev => ({
      ...prev,
      ticker: result.symbol,
      name: prev.name || result.name,
    }));
  }

  // Holdings compatible with this SIP's asset type
  const compatibleHoldings = holdings.filter(h => {
    if (form.asset_type === "mutual_fund") return h.asset_type === "mutual_fund";
    if (form.asset_type === "etf") return h.asset_type === "etf";
    if (form.asset_type === "stock") return h.asset_type === "stock";
    return false;
  });

  const linkedHolding = holdings.find(h => h.id === form.holding_id);

  const isMF     = form.asset_type === "mutual_fund";
  const isTicker = form.asset_type === "stock" || form.asset_type === "etf";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setValidationError(null);

    // ── Client-side validation ──
    if (isMF && !form.name.trim()) {
      setValidationError("Please search and select a mutual fund before saving.");
      return;
    }
    if (isTicker && !form.ticker.trim()) {
      setValidationError("Please search or type a ticker symbol (e.g. NIFTYBEES.NS) before saving.");
      return;
    }
    const amount = parseFloat(form.sip_amount);
    if (!form.sip_amount || isNaN(amount) || amount <= 0) {
      setValidationError("SIP Amount must be a valid number greater than 0.");
      return;
    }

    const payload = {
      name:                    form.name || undefined,
      asset_type:              form.asset_type,
      sip_amount:              parseFloat(form.sip_amount),
      frequency:               form.frequency,
      sip_date:                parseInt(form.sip_date),
      start_date:              form.start_date,
      end_date:                form.end_date || undefined,
      total_installments_done: parseInt(form.total_installments_done) || 0,
      total_invested:          parseFloat(form.total_invested) || 0,
      holding_id:              form.holding_id || undefined,
      account:                 form.account || undefined,
      mfapi_code:              form.mfapi_code || undefined,
      ticker:                  form.ticker || undefined,
      is_active:               true,
      notes:                   form.notes || undefined,
      // Only pass auto flags when not editing and no holding is selected
      auto_match_holding:      !isEditing && !form.holding_id,
      auto_create_holding:     !isEditing && !form.holding_id && form.auto_create_holding,
    };
    await onSubmit(payload);
  }

  const dateSuffix = (d: number) => {
    if (d >= 11 && d <= 13) return "th";
    switch (d % 10) {
      case 1: return "st"; case 2: return "nd"; case 3: return "rd";
      default: return "th";
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      {/* Validation / API error banner */}
      {validationError && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-rose-fin/10 border border-rose-fin/30 text-rose-fin text-sm">
          <XCircle size={15} className="mt-0.5 flex-shrink-0" />
          {validationError}
        </div>
      )}

      <div>
        <label className="label">Asset Type</label>
        <div className="flex gap-2">
          {SIP_ASSET_TYPES.map(t => (
            <button
              key={t.value}
              type="button"
              onClick={() => {
                set("asset_type", t.value);
                set("holding_id", "");
              }}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all border ${
                form.asset_type === t.value
                  ? "bg-violet/20 border-violet text-violet-light"
                  : "bg-surface-overlay border-white/10 text-text-muted hover:border-white/20"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Fund / instrument name */}
      {isMF ? (
        <div>
          <label className="label flex items-center gap-1.5">
            Fund Name <Zap size={12} className="text-gold" />
            <span className="text-text-muted font-normal text-xs">(search by name)</span>
          </label>
          <MFSearchInput onSelect={handleMFSelect} selectedName={form.name} />
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
          <label className="label flex items-center gap-1.5">
            {form.asset_type === "etf" ? "ETF" : "Stock"}
            {isTicker && <Zap size={12} className="text-gold" />}
            {isTicker && <span className="text-text-muted font-normal text-xs">(search by name)</span>}
          </label>
          {isTicker ? (
            <>
              <TickerSearchInput
                onSelect={handleTickerSelect}
                selectedSymbol={form.ticker || undefined}
                selectedName={form.name || undefined}
                assetType={form.asset_type as "stock" | "etf"}
              />
              <input
                type="text"
                value={form.ticker}
                onChange={e => set("ticker", e.target.value.toUpperCase())}
                placeholder="Or type symbol directly — e.g. NIFTYBEES.NS"
                className="input mt-2 text-xs font-mono"
              />
              {form.name && (
                <input
                  type="text"
                  value={form.name}
                  onChange={e => set("name", e.target.value)}
                  className="input mt-1.5 text-xs"
                  placeholder="Display name"
                />
              )}
            </>
          ) : (
            <input
              type="text"
              value={form.name}
              onChange={e => set("name", e.target.value)}
              placeholder="e.g. Reliance Industries"
              className="input"
              required
            />
          )}
        </div>
      )}

      {/* Link to Holding ──────────────────────────────────────── */}
      <div className="p-3 rounded-xl bg-surface-overlay border border-white/[0.06] space-y-2.5">
        <div className="flex items-center gap-1.5">
          <Link2 size={13} className="text-violet-light" />
          <p className="text-text-secondary text-xs font-medium">Link to Holding</p>
          <span className="text-text-muted text-[10px] ml-auto">
            enables auto-update of units when recording installment
          </span>
        </div>

        {compatibleHoldings.length > 0 ? (
          <>
            <select
              className="select text-sm"
              value={form.holding_id}
              onChange={e => {
                set("holding_id", e.target.value);
                set("auto_create_holding", false);
              }}
            >
              <option value="">— Select holding to link —</option>
              {compatibleHoldings.map(h => (
                <option key={h.id} value={h.id}>
                  {h.name}{h.account ? ` (${h.account})` : ""}
                </option>
              ))}
            </select>

            {linkedHolding && (
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-fin">
                <CheckCircle2 size={11} />
                Linked — recording installments will update this holding&apos;s units &amp; avg price
              </div>
            )}

            {!form.holding_id && !isEditing && (
              <label className="flex items-center gap-2 text-xs text-text-muted cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.auto_create_holding}
                  onChange={e => set("auto_create_holding", e.target.checked)}
                  className="rounded"
                />
                Create a new holding automatically for this SIP
              </label>
            )}
          </>
        ) : (
          <>
            <div className="flex items-start gap-1.5 text-[11px] text-text-muted">
              <AlertCircle size={11} className="mt-0.5 flex-shrink-0 text-amber-400" />
              No {form.asset_type.replace("_", " ")} holdings found to link.
            </div>
            {!isEditing && (
              <label className="flex items-center gap-2 text-xs text-text-muted cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.auto_create_holding}
                  onChange={e => set("auto_create_holding", e.target.checked)}
                  className="rounded"
                />
                Create a new holding automatically for this SIP
              </label>
            )}
          </>
        )}

        {form.auto_create_holding && (
          <p className="text-[11px] text-violet-light">
            A new holding with 0 units will be created. Units accumulate automatically as you record installments.
          </p>
        )}
      </div>

      {/* SIP Amount + Frequency */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">SIP Amount (₹)</label>
          <input
            type="number"
            value={form.sip_amount}
            onChange={e => set("sip_amount", e.target.value)}
            placeholder="5000"
            min="1"
            step="1"
            className="input"
            required
          />
        </div>
        <div>
          <label className="label">Frequency</label>
          <select
            value={form.frequency}
            onChange={e => set("frequency", e.target.value as SipFrequency)}
            className="select"
          >
            {FREQUENCY_OPTIONS.map(f => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* SIP Date + Start Date */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label flex items-center gap-1.5">
            <CalendarDays size={12} className="text-text-muted" />
            SIP Day of Month
          </label>
          <input
            type="number"
            value={form.sip_date}
            onChange={e => set("sip_date", e.target.value)}
            min="1"
            max="31"
            className="input"
            required
          />
          {form.sip_date && (
            <p className="text-text-muted text-xs mt-1">
              Executes on the{" "}
              <span className="text-text-secondary font-medium">
                {form.sip_date}{dateSuffix(parseInt(form.sip_date))}
              </span>{" "}
              of each {form.frequency === "quarterly" ? "quarter" : form.frequency === "weekly" ? "week" : "month"}
            </p>
          )}
        </div>
        <div>
          <label className="label">Start Date</label>
          <input
            type="date"
            value={form.start_date}
            onChange={e => set("start_date", e.target.value)}
            className="input"
            required
          />
        </div>
      </div>

      {/* End Date */}
      <div>
        <label className="label">End Date <span className="text-text-muted">(optional)</span></label>
        <input
          type="date"
          value={form.end_date}
          onChange={e => set("end_date", e.target.value)}
          min={form.start_date}
          className="input"
        />
        <p className="text-text-muted text-xs mt-1">Leave blank for an open-ended SIP mandate</p>
      </div>

      {/* Pre-existing history */}
      {!isEditing && (
        <div className="p-3 rounded-xl bg-surface-overlay border border-white/[0.06] space-y-3">
          <p className="text-text-secondary text-xs font-medium">
            Already running? Log what&apos;s already invested:
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-xs">Installments Done</label>
              <input
                type="number"
                value={form.total_installments_done}
                onChange={e => set("total_installments_done", e.target.value)}
                min="0"
                className="input text-sm"
              />
            </div>
            <div>
              <label className="label text-xs">Total Invested (₹)</label>
              <input
                type="number"
                value={form.total_invested}
                onChange={e => set("total_invested", e.target.value)}
                min="0"
                step="1"
                className="input text-sm"
              />
            </div>
          </div>
        </div>
      )}

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
          {ACCOUNT_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
          <option value="Other">Other…</option>
        </select>
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
          placeholder="e.g. Goal: retirement corpus, auto-debit from SBI"
        />
      </div>

      {/* Buttons */}
      <div className="flex gap-3 justify-end pt-1">
        <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Saving..." : isEditing ? "Save Changes" : "Add SIP"}
        </button>
      </div>
    </form>
  );
}
