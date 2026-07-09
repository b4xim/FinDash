"use client";

// ============================================================
// TrendBarChart — spending vs income bar chart, last 6 months
// ============================================================

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { formatINR } from "@/lib/utils";

interface TrendBarChartProps {
  data: { month: string; spend: number; income: number }[];
}

// Custom tooltip
function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-overlay border border-white/10 rounded-xl px-4 py-3 shadow-card min-w-36">
      <p className="text-text-secondary text-xs mb-2">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex justify-between gap-4 text-sm">
          <span style={{ color: p.color }} className="text-xs capitalize">{p.name}</span>
          <span className="font-mono text-xs text-text-primary">{formatINR(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export default function TrendBarChart({ data }: TrendBarChartProps) {
  if (!data.length) {
    return (
      <div className="h-48 flex items-center justify-center border border-dashed border-white/10 rounded-xl">
        <p className="text-text-muted text-sm">No data yet</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} barGap={4} barCategoryGap="30%">
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fill: "#4A5270", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "#4A5270", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={v => v >= 100000 ? `${(v/100000).toFixed(1)}L` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : v}
          width={40}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
        <Bar dataKey="income" name="Income" fill="#10D98C" radius={[4, 4, 0, 0]} maxBarSize={32} />
        <Bar dataKey="spend"  name="Spend"  fill="#7C5CFC" radius={[4, 4, 0, 0]} maxBarSize={32} />
        <Legend
          wrapperStyle={{ fontSize: "11px", color: "#8A94B2", paddingTop: "12px" }}
          iconType="circle"
          iconSize={8}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
