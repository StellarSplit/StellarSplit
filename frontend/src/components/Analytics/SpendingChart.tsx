import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { SpendingTrend } from "../../types/analytics";
import { useTheme } from "../ThemeContext";

interface SpendingChartProps {
  data: SpendingTrend[];
  onPeriodSelect?: (period: string) => void;
}

function formatMonth(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function formatCurrency(value: number): string {
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

/** Re-reads CSS custom properties from :root whenever the resolved theme changes. */
function useThemeColors() {
  const { resolvedTheme } = useTheme();
  return useMemo(
    () => ({
      accentColor: cssVar("--color-accent"),
      borderColor: cssVar("--color-border"),
      mutedColor: cssVar("--color-text-muted"),
      surfaceColor: cssVar("--color-surface"),
      textColor: cssVar("--color-text"),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resolvedTheme],
  );
}

export function SpendingChart({ data, onPeriodSelect }: SpendingChartProps) {
  const { resolvedTheme } = useTheme();
  const { accentColor, borderColor, mutedColor, surfaceColor, textColor } =
    useThemeColors();

  const chartData = data.map((d) => ({
    ...d,
    label: formatMonth(d.period),
  }));

  return (
    <div
      className="bg-card-theme rounded-lg shadow border border-theme p-6"
      id="spending-chart"
    >
      <h2 className="text-xl font-bold text-theme mb-4">Spending Trends</h2>

      <ResponsiveContainer width="100%" height={300}>
        <AreaChart
          data={chartData}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onClick={(e: any) => {
            if (e?.activePayload?.[0] && onPeriodSelect) {
              onPeriodSelect(e.activePayload[0].payload.period);
            }
          }}
        >
          <defs>
            <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="5%"
                stopColor={accentColor}
                stopOpacity={resolvedTheme === "dark" ? 0.2 : 0.3}
              />
              <stop offset="95%" stopColor={accentColor} stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke={borderColor} />

          <XAxis
            dataKey="label"
            tick={{ fill: mutedColor, fontSize: 12 }}
            axisLine={{ stroke: borderColor }}
          />
          <YAxis
            tickFormatter={formatCurrency}
            tick={{ fill: mutedColor, fontSize: 12 }}
            axisLine={{ stroke: borderColor }}
          />

          <Tooltip
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any) => [
              formatCurrency(Number(value ?? 0)),
              "Total Spent",
            ]}
            contentStyle={{
              backgroundColor: surfaceColor,
              border: `1px solid ${borderColor}`,
              borderRadius: "0.5rem",
              boxShadow:
                resolvedTheme === "dark"
                  ? "0 1px 3px rgba(0,0,0,0.4)"
                  : "0 1px 3px rgba(0,0,0,0.1)",
              color: textColor,
            }}
            labelStyle={{ color: textColor }}
          />

          <Area
            type="monotone"
            dataKey="totalSpent"
            stroke={accentColor}
            strokeWidth={2}
            fill="url(#spendGradient)"
            animationDuration={1000}
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* ── Summary Stats ── */}
      <div className="mt-4 grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-sm text-muted-theme">Total</p>
          <p className="text-lg font-semibold text-theme">
            {formatCurrency(data.reduce((s, d) => s + d.totalSpent, 0))}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-theme">Transactions</p>
          <p className="text-lg font-semibold text-theme">
            {data.reduce((s, d) => s + d.transactionCount, 0)}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-theme">Avg / Tx</p>
          <p className="text-lg font-semibold text-theme">
            {formatCurrency(
              data.length
                ? data.reduce((s, d) => s + d.avgTransactionAmount, 0) /
                    data.length
                : 0,
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
