import { View, Text, Svg, Path, Line, Rect, Circle, G, Text as SvgText } from "@react-pdf/renderer";
import { formatDate } from "@/lib/dates";
import { formatUSD } from "@/lib/money";
import { axisTicks, barRect, donutSlices, lineGeometry, sampleIndices } from "@/lib/reports/chartGeometry";
import type { ReportData } from "@/lib/reports/types";
import { colors, styles } from "./theme";
const Empty = () => <Text style={styles.caption}>Not enough data for this period.</Text>;
export function BalanceLineChart({ data }: { data: ReportData }) {
  const points = data.balanceSeries ?? [];
  if (points.length < 2) return <Empty />;
  const g = lineGeometry(points, data.bufferCents);
  const minimum = g.minimum!;
  return <View wrap={false}><Svg width={532} height={260} viewBox="0 0 532 260">
    {g.ticks.map(tick => <G key={tick}><Line x1={70} x2={510} y1={g.y(tick)} y2={g.y(tick)} stroke={colors.line} strokeWidth={0.5} /><SvgText x={63} y={g.y(tick) + 3} textAnchor="end" style={{ fontSize: 8, fill: colors.muted }}>{formatUSD(tick)}</SvgText></G>)}
    <Line x1={70} x2={510} y1={g.y(data.bufferCents)} y2={g.y(data.bufferCents)} stroke={colors.good} strokeDasharray="2 3" />
    {g.actual && <Path d={g.actual} stroke={colors.accent} strokeWidth={2} fill="none" />}
    {g.forecast && <Path d={g.forecast} stroke={colors.accent} strokeWidth={2} strokeDasharray="5 3" fill="none" />}
    {data.meta.today >= points[0].date && data.meta.today <= points.at(-1)!.date && <><Line x1={g.x(data.meta.today)} x2={g.x(data.meta.today)} y1={10} y2={225} stroke={colors.muted} strokeDasharray="2 3" /><SvgText x={g.x(data.meta.today)} y={250} textAnchor="middle" style={{ fontSize: 8 }}>Today</SvgText></>}
    <Circle cx={g.x(minimum.date)} cy={g.y(minimum.balanceCents)} r={3} fill={colors.bad} />
    {sampleIndices(points.length).map(index => <SvgText key={index} x={g.x(points[index].date)} y={238} textAnchor="middle" style={{ fontSize: 8, fill: colors.muted }}>{formatDate(points[index].date, "short")}</SvgText>)}
  </Svg><Text style={styles.caption}>Solid: reconstructed actual · Dashed: projected · Dotted: critical threshold {formatUSD(data.bufferCents)}</Text><Text style={styles.caption}>Lowest: {formatUSD(minimum.balanceCents)} on {minimum.date}. Historical values depend on the completeness of recorded activity.</Text></View>;
}
export function CategoryDonutChart({ data }: { data: ReportData }) {
  const slices = data.categoryBreakdown ?? [];
  if (!slices.length) return <Empty />;
  const geometry = donutSlices(slices.map(slice => slice.amountCents));
  return <View wrap={false} style={{ flexDirection: "row", alignItems: "center", gap: 20 }}><Svg width={190} height={210} viewBox="0 0 190 210">{geometry.map((g, i) => <Path key={i} d={g.path} fill={colors.palette[i]} stroke="#ffffff" strokeWidth={1} />)}</Svg><View style={{ flex: 1 }}>{slices.map((slice, i) => <View key={slice.category} style={{ flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 10 }}><View style={{ width: 9, height: 9, backgroundColor: colors.palette[i] }} /><Text style={{ width: 130 }}>{slice.category}</Text><Text style={{ flex: 1, textAlign: "right", fontSize: 9 }}>{formatUSD(slice.amountCents)} · {slice.pctOfTotal}%</Text></View>)}</View></View>;
}
export function IncomeExpenseBarChart({ data }: { data: ReportData }) {
  const buckets = data.flowBuckets ?? [];
  if (!buckets.some(b => b.incomeCents || b.expensesCents)) return <Empty />;
  const max = Math.max(...buckets.flatMap(b => [b.incomeCents, b.expensesCents]));
  return <View wrap={false}><Svg width={532} height={250} viewBox="0 0 532 250">
    {axisTicks(0, max).map(tick => <G key={tick}><Line x1={65} x2={510} y1={190 - tick / max * 170} y2={190 - tick / max * 170} stroke={colors.line} strokeWidth={0.5} /><SvgText x={58} y={193 - tick / max * 170} textAnchor="end" style={{ fontSize: 8, fill: colors.muted }}>{formatUSD(tick)}</SvgText></G>)}
    {buckets.map((b, i) => <G key={b.start}>{[b.incomeCents, b.expensesCents].map((value, series) => { const rect = barRect(value, max, i, buckets.length, series); return <G key={series}><Rect {...rect} fill={series === 0 ? colors.good : colors.accent} />{buckets.length * 2 <= 12 && value > 0 && <SvgText x={rect.x + rect.width / 2} y={rect.y - 5} textAnchor="middle" style={{ fontSize: 7 }}>{formatUSD(value)}</SvgText>}</G>; })}<SvgText x={65 + 440 / buckets.length * (i + 0.5)} y={210 + (i % 2) * 12} textAnchor="middle" style={{ fontSize: 7 }}>{b.label}</SvgText></G>)}
  </Svg><Text style={styles.caption}>Green: income · Blue: expenses · Recorded activity only</Text></View>;
}
export function GoalProgressBars({ data }: { data: ReportData }) {
  const goals = data.goals ?? [];
  if (!goals.length) return <Text style={styles.caption}>{data.meta.range.end < data.meta.today ? "Historical goal snapshots are not recorded. Open a range including today to see current plans." : "No savings goals yet."}</Text>;
  return <><Text style={styles.caption}>Current plans as of {data.meta.today}. The app does not record actual goal contributions; progress is unavailable until those records exist. Completion dates are current estimates.</Text>{goals.slice(0, 8).map((goal, i) => <View key={i} wrap={false} style={{ marginTop: 22 }}><Text style={{ fontFamily: "Helvetica-Bold" }}>{goal.name}</Text><Text style={styles.caption}>{goal.savedCents === null ? "Saved amount unavailable" : formatUSD(goal.savedCents)} of {formatUSD(goal.targetCents)} · {goal.pct === null ? "Progress unavailable" : `${goal.pct}%`}</Text><Svg width={500} height={14}><Rect x={0} y={3} width={500} height={8} rx={4} fill={colors.line} />{goal.pct !== null && <Rect x={0} y={3} width={Math.max(0, Math.min(100, goal.pct)) * 5} height={8} rx={4} fill={colors.accent} />}</Svg>{goal.estimatedCompletion && <Text style={styles.caption}>Estimated completion: {goal.estimatedCompletion}</Text>}</View>)}{goals.length > 8 && <Text style={styles.caption}>{goals.length - 8} more goals not shown.</Text>}</>;
}
