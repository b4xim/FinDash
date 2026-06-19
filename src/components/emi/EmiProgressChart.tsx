"use client";

// ============================================================
// EmiProgressChart — SVG radial ring showing % loan repaid
// ============================================================

interface EmiProgressChartProps {
  paidMonths: number;
  totalMonths: number;
  size?: number;
  strokeWidth?: number;
}

export default function EmiProgressChart({
  paidMonths,
  totalMonths,
  size = 80,
  strokeWidth = 8,
}: EmiProgressChartProps) {
  const pct = totalMonths > 0 ? Math.min(paidMonths / totalMonths, 1) : 0;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - pct);
  const cx = size / 2;
  const cy = size / 2;

  // Colour: green when > 75%, amber when > 40%, violet otherwise
  const color = pct >= 0.75 ? "#10D98C" : pct >= 0.4 ? "#F5A623" : "#7C5CFC";

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Background track */}
      <circle
        cx={cx} cy={cy} r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={strokeWidth}
      />
      {/* Progress arc */}
      <circle
        cx={cx} cy={cy} r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: "stroke-dashoffset 0.6s ease, stroke 0.4s ease" }}
      />
      {/* Percentage label */}
      <text
        x={cx} y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fill={color}
        fontSize={size * 0.2}
        fontWeight="700"
        fontFamily="Inter, sans-serif"
      >
        {Math.round(pct * 100)}%
      </text>
    </svg>
  );
}
