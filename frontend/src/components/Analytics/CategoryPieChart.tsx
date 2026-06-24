import { useMemo, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { CategoryBreakdown } from "../../types/analytics";
import { useTheme } from "../ThemeContext";

interface CategoryPieChartProps {
  data: CategoryBreakdown[];
}

const PALETTE_FIXED = ["#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#6b7280"];

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

export function CategoryPieChart({ data }: CategoryPieChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const { resolvedTheme } = useTheme();
  const { accentColor, borderColor, mutedColor, surfaceColor, textColor } =
    useThemeColors();

  // First slice uses the brand accent color; remaining slices use fixed palette
  const COLORS = [accentColor, ...PALETTE_FIXED];

  const total = data.reduce((s, d) => s + d.amount, 0);

  return (
    <div
      className="bg-card-theme rounded-lg shadow border border-theme p-6"
      id="category-pie-chart"
    >
      <h2 className="text-xl font-bold text-theme mb-4">Category Breakdown</h2>

      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            dataKey="amount"
            nameKey="category"
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={activeIndex !== null ? 115 : 110}
            paddingAngle={2}
            animationDuration={800}
            onMouseEnter={(_, index) => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(null)}
          >
            {data.map((_, index) => (
              <Cell
                key={index}
                fill={COLORS[index % COLORS.length]}
                opacity={
                  activeIndex !== null && activeIndex !== index ? 0.5 : 1
                }
                style={{ transition: "opacity 200ms ease" }}
              />
            ))}
          </Pie>

          <Tooltip
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any, name: any) => {
              const v = Number(value ?? 0);
              return [
                `${formatCurrency(v)} (${((v / total) * 100).toFixed(1)}%)`,
                name,
              ];
            }}
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

          <Legend
            verticalAlign="bottom"
            iconType="circle"
            formatter={(value: string) => (
              <span style={{ color: mutedColor, fontSize: "0.875rem" }}>
                {value}
              </span>
            )}
          />

          {/* Center label – must use inline fill, not Tailwind */}
          <text
            x="50%"
            y="48%"
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={16}
            fontWeight={700}
            fill={textColor}
          >
            {formatCurrency(total)}
          </text>
          <text
            x="50%"
            y="56%"
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={12}
            fill={mutedColor}
          >
            Total
          </text>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
