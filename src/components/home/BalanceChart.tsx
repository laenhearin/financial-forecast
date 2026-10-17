import Link from "next/link";
import { formatUSD } from "@/lib/money";
import { ROUTES } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { CHART, describeBalanceChart, layoutBalanceChart } from "./balanceChartGeometry";
import type { BillMarker, ProjectionPoint } from "./types";

interface BalanceChartProps {
  availableBalanceCents: number;
  projection: ProjectionPoint[];
  markers: BillMarker[];
  /** Shows a "Sample data" tag while the page uses fixtures. */
  isSampleData?: boolean;
  /** Swaps the chart for placeholder blocks (not wired up yet). */
  isLoading?: boolean;
  className?: string;
}

const skeleton = "animate-pulse bg-skeleton motion-reduce:animate-none";

/** Balance caption row plus a hand-drawn SVG of the 30-day projection. */
export function BalanceChart({ availableBalanceCents, projection, markers, isSampleData = false, isLoading = false, className }: BalanceChartProps) {
  if (isLoading) {
    return (
      <div aria-busy="true" className={className}>
        <div className={cn("h-7 w-56 rounded-item", skeleton)} />
        <div className={cn("mt-3 h-50 rounded-panel", skeleton)} />
      </div>
    );
  }

  const layout = layoutBalanceChart(projection, markers);
  const labelText = "fill-secondary text-micro";

  return (
    <div className={className}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-figure font-medium text-primary">{formatUSD(availableBalanceCents)}</span>
        <span className="text-caption text-secondary">available, next {layout.lastDay} days</span>
        {isSampleData && <span className="self-center rounded-full border border-app px-2 text-micro text-secondary">Sample data</span>}
        <Link href={ROUTES.calendar} className="ml-auto text-caption font-medium text-accent hover:underline">
          Open calendar
        </Link>
      </div>

      <svg
        viewBox={`0 0 ${CHART.width} ${CHART.height}`}
        role="img"
        aria-labelledby="balance-chart-title balance-chart-desc"
        className="mt-3 block h-auto w-full overflow-visible rounded-panel"
      >
        <title id="balance-chart-title">{`Projected balance, next ${layout.lastDay} days`}</title>
        <desc id="balance-chart-desc">{describeBalanceChart(projection, layout.markers)}</desc>

        <path d={layout.areaPath} className="fill-chart-area" />
        <line x1={0} x2={CHART.width} y1={CHART.baselineY} y2={CHART.baselineY} className="stroke-app" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        <path
          d={layout.linePath}
          fill="none"
          className="stroke-accent"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />

        {layout.markers.map((m) => (
          <g key={`${m.day}-${m.label}`}>
            <circle cx={m.cx} cy={m.cy} r={CHART.markerRadius} className="fill-card stroke-rain" strokeWidth={2} vectorEffect="non-scaling-stroke" />
            <text x={m.labelX} y={m.labelY} textAnchor={m.anchor} dominantBaseline="hanging" className={labelText}>
              {m.label}
            </text>
          </g>
        ))}

        <text x={0} y={CHART.xLabelY} dominantBaseline="hanging" className={labelText}>
          Today
        </text>
        <text x={CHART.width} y={CHART.xLabelY} textAnchor="end" dominantBaseline="hanging" className={labelText}>
          Day {layout.lastDay}
        </text>
      </svg>
    </div>
  );
}
