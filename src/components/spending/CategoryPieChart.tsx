"use client";

// ============================================================
// CategoryPieChart — donut chart of spending by category
// Uses Recharts — renders client-side only
// ============================================================

import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { CATEGORY_COLORS, formatINR } from "@/lib/utils";

interface CategoryPieChartProps {
  data: { name: string; value: number }[];
}

// Custom tooltip shown on hover
function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number }> }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-overlay border border-white/10 rounded-xl px-4 py-3 shadow-card">
      <p className="text-text-primary text-sm font-medium">{payload[0].name}</p>
      <p className="text-violet-light font-mono text-sm mt-0.5">{formatINR(payload[0].value)}</p>
    </div>
  );
}

// Custom legend rendered below the chart
function CustomLegend({ data }: { data: { name: string; value: number }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="mt-4 space-y-2">
      {data.slice(0, 6).map(item => (
        <div key={item.name} className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ background: CATEGORY_COLORS[item.name] ?? "#4A5270" }}
            />
            <span className="text-text-secondary text-xs">{item.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-text-muted text-xs font-mono">
              {total > 0 ? Math.round((item.value / total) * 100) : 0}%
            </span>
            <span className="text-text-primary text-xs font-mono w-20 text-right">
              {formatINR(item.value)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function CategoryPieChart({ data }: CategoryPieChartProps) {
  if (!data.length) {
    return (
      <div className="h-48 flex items-center justify-center border border-dashed border-white/10 rounded-xl">
        <p className="text-text-muted text-sm">No spending data yet</p>
      </div>
    );
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={2}
            dataKey="value"
            strokeWidth={0}
          >
            {data.map((entry) => (
              <Cell
                key={entry.name}
                fill={CATEGORY_COLORS[entry.name] ?? "#4A5270"}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <CustomLegend data={data} />
    </div>
  );
}
