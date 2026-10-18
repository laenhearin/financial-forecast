import { Text, View } from "@react-pdf/renderer";
import { dayOfWeek, formatDate } from "@/lib/dates";
import { formatUSD } from "@/lib/money";
import { rangeLabel } from "@/lib/reports/dateRange";
import type { ReportData, ScheduleRow } from "@/lib/reports/types";
import { colors, styles } from "./theme";
function ScheduleTable({ title, rows }: { title: string; rows: ScheduleRow[] }) {
  return <><Text style={styles.subtitle}>{title}</Text>{!rows.length ? <Text style={styles.caption}>No entries available for this period.</Text> : <>
    <View style={[styles.row, { backgroundColor: colors.pale }]} wrap={false}>{["Date", "Name", "Amount", "Status"].map((label, i) => <Text key={label} style={{ width: [80, 250, 105, 85][i], fontFamily: "Helvetica-Bold" }}>{label}</Text>)}</View>
    {rows.map((row, i) => <View key={i} wrap={false} style={styles.row}><Text style={{ width: 80 }}>{row.date}</Text><Text style={{ width: 250, paddingRight: 8 }}>{row.name}</Text><Text style={{ width: 105 }}>{formatUSD(row.amountCents)}</Text><Text style={{ width: 85, color: row.status === "upcoming" || row.status === "expected" ? colors.accent : colors.ink }}>{row.status}</Text></View>)}
    <View style={styles.row} wrap={false}><Text style={{ flex: 1, fontFamily: "Helvetica-Bold" }}>Subtotal</Text><Text>{formatUSD(rows.reduce((sum, row) => sum + row.amountCents, 0))}</Text></View>
  </>}</>;
}
export function BillsPaychecksSection({ data }: { data: ReportData }) {
  return <><Text style={styles.caption}>Received deposits are recorded activity, not all necessarily paychecks. Expected income is an assumption; upcoming bills are scheduled. Historical bill-to-payment matches are unavailable. Upcoming entries stop at the app&apos;s 90-day forecast horizon.</Text><ScheduleTable title="Paychecks & deposits" rows={data.paychecks ?? []} /><ScheduleTable title="Bills" rows={data.bills ?? []} /></>;
}
export function ForecastCalendarSection({ data }: { data: ReportData }) {
  const days = data.weatherDays ?? [];
  if (!days.length || !data.forecastWindow) return <Text style={styles.caption}>No forecast available for this period.</Text>;
  const months = [...new Set(days.map(day => day.date.slice(0, 7)))];
  const low = days.reduce((a, b) => a.endBalanceCents <= b.endBalanceCents ? a : b);
  const highest = Math.max(...days.map(day => day.level));
  const rainiest = days.filter(day => day.level === highest);
  return <><Text style={styles.paragraph}>Forecast: {rangeLabel(data.forecastWindow)}</Text><Text style={styles.caption}>Baseline forecast with scheduled bills and estimated income/spending. Saved hypothetical purchases are evaluated separately in Purchase Advisor results.</Text>
    {months.map(month => { const monthDays = days.filter(day => day.date.startsWith(month)); const cells = [...Array.from({ length: dayOfWeek(monthDays[0].date) }, () => null), ...monthDays];
      return <View key={month} wrap={false} style={{ marginTop: 16 }}><Text style={styles.subtitle}>{formatDate(`${month}-01`, "monthYear")}</Text><View style={{ flexDirection: "row" }}>{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => <Text key={day} style={{ width: 76, padding: 4, fontSize: 8 }}>{day}</Text>)}</View><View style={{ flexDirection: "row", flexWrap: "wrap" }}>{cells.map((day, index) => <View key={index} style={{ width: 76, height: 48, padding: 5, border: "1 solid #ffffff", backgroundColor: day ? colors.weather[day.level] : "#f4f7fa", color: "#ffffff" }}>{day && <><Text style={{ fontFamily: "Helvetica-Bold", fontSize: 10 }}>{Number(day.date.slice(8))}</Text><Text style={{ fontSize: 6 }}>{day.label}</Text><Text style={{ fontSize: 7 }}>{formatUSD(day.endBalanceCents)}</Text></>}</View>)}</View></View>; })}
    <Text style={styles.caption}>Colors match Weather Calendar: green Thriving · blue Stable · gold Caution · orange Near critical · red Critical · purple Below $0.</Text>
    <Text style={[styles.paragraph, { marginTop: 14 }]}>Lowest projected balance: {formatUSD(low.endBalanceCents)} on {low.date}.</Text><Text style={styles.caption}>Highest risk: {low.label}. {rainiest.length} day(s), starting {rainiest[0].date}{rainiest.length > 1 ? `; last ${rainiest.at(-1)!.date}` : ""}. Critical threshold: {formatUSD(data.bufferCents)}.</Text>
  </>;
}
