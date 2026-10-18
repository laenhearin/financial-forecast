import {
  Document,
  Page,
  View,
  Text,
  Svg,
  Circle,
  Path,
  Link,
} from "@react-pdf/renderer";
import { APP_NAME } from "@/lib/config";
import { formatUSD } from "@/lib/money";
import { rangeLabel } from "@/lib/reports/dateRange";
import { SECTIONS } from "@/lib/reports/sections";
import type { ReportData } from "@/lib/reports/types";
import {
  BalanceLineChart,
  CategoryDonutChart,
  IncomeExpenseBarChart,
  GoalProgressBars,
} from "./Charts";
import {
  BillsPaychecksSection,
  ForecastCalendarSection,
} from "./BillsForecast";
import {
  TransactionsSection,
  CardsRewardsSection,
  AdvisorSolverSection,
} from "./DetailSections";
import { colors, styles } from "./theme";

function Footer({ data }: { data: ReportData }) {
  return (
    <>
      <Text
        fixed
        style={{
          position: "absolute",
          bottom: 24,
          left: 40,
          width: 410,
          height: 14,
          fontSize: 7,
          color: colors.muted,
        }}
      >
        {APP_NAME} · {data.meta.title}
      </Text>
      <Text
        fixed
        style={{
          position: "absolute",
          bottom: 24,
          right: 40,
          width: 100,
          height: 14,
          fontSize: 7,
          color: colors.muted,
          textAlign: "right",
        }}
        render={({ pageNumber, totalPages }) =>
          `Page ${pageNumber} of ${totalPages}`
        }
      />
    </>
  );
}
function Overview({ data }: { data: ReportData }) {
  const numbers = data.keyNumbers;
  if (!numbers) return null;
  const metrics = [
    ["Total income", numbers.incomeCents],
    ["Total spending", numbers.spendingCents],
    ["Net", numbers.netCents],
    ["Bills paid (matched)", numbers.billsPaidCents],
    ["Savings contributed (identified)", numbers.savingsContributedCents],
    ["Ending balance (estimate)", numbers.endingBalanceCents],
  ] as const;
  return (
    <>
      <Text style={styles.paragraph}>{data.summary?.text}</Text>
      {data.summary?.source === "fallback" && (
        <Text style={styles.caption}>
          Generated automatically from your numbers
        </Text>
      )}
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          marginTop: 18,
          gap: 10,
        }}
      >
        {metrics.map(([label, value]) => (
          <View
            key={label}
            wrap={false}
            style={{
              width: 168,
              padding: 12,
              backgroundColor: colors.pale,
              borderRadius: 6,
            }}
          >
            <Text style={styles.caption}>{label}</Text>
            <Text style={{ fontSize: 18, marginTop: 5 }}>
              {value ? formatUSD(value.current) : "Unavailable"}
            </Text>
            {value && data.compareToPrevious && (
              <View>
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                >
                  <Svg width={8} height={8}>
                    <Path
                      d={
                        value.change >= 0
                          ? "M 4 0 L 8 8 L 0 8 Z"
                          : "M 0 0 L 8 0 L 4 8 Z"
                      }
                      fill={
                        (
                          label === "Total spending"
                            ? value.change <= 0
                            : value.change >= 0
                        )
                          ? colors.good
                          : colors.bad
                      }
                    />
                  </Svg>
                  <Text style={styles.caption}>
                    {value.pct === null
                      ? "n/a"
                      : `${value.pct > 0 ? "+" : ""}${(value.pct * 100).toFixed(Math.abs(value.pct) < 0.1 ? 1 : 0)}%`}
                  </Text>
                </View>
                <Text style={styles.caption}>
                  Prev: {formatUSD(value.previous)}
                </Text>
              </View>
            )}
          </View>
        ))}
      </View>
      {data.notes.map((note) => (
        <Text key={note} style={styles.caption}>
          {note}
        </Text>
      ))}
    </>
  );
}
export function ReportDocument({ data }: { data: ReportData }) {
  return (
    <Document
      title={data.meta.title}
      author={APP_NAME}
      subject="Personal financial report"
    >
      <Page
        size="LETTER"
        style={[styles.page, { backgroundColor: colors.pale, paddingTop: 70 }]}
      >
        <Text
          style={{
            color: colors.accent,
            fontSize: 14,
            fontFamily: "Helvetica-Bold",
          }}
        >
          {APP_NAME}
        </Text>
        <Svg
          width={230}
          height={150}
          viewBox="0 0 230 150"
          style={{ marginTop: 65 }}
        >
          <Circle cx={150} cy={50} r={35} fill="#e5ba55" />
          <Path
            d="M 30 120 C 0 120 0 75 36 75 C 40 25 120 25 126 76 C 172 52 207 120 161 120 Z"
            fill={colors.accent}
          />
        </Svg>
        <Text style={[styles.title, { fontSize: 34, marginTop: 40 }]}>
          {data.meta.title}
        </Text>
        <Text style={{ fontSize: 16 }}>{rangeLabel(data.meta.range)}</Text>
        <Text style={{ marginTop: 28, fontSize: 15 }}>
          {data.meta.customerName}
        </Text>
        <Text style={styles.caption}>
          Generated on {data.meta.today} · America/New_York
        </Text>
        <Text style={[styles.caption, { marginTop: 55 }]}>
          {data.meta.sourceLabel}
        </Text>
        <Text style={styles.caption}>
          Personal review · USD · Forecasts are estimates
        </Text>
      </Page>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.title}>In this report</Text>
        {data.includedSections.map((id) => (
          <Link
            key={id}
            src={`#${id}`}
            style={{
              paddingVertical: 12,
              borderBottom: `0.5 solid ${colors.line}`,
              color: colors.accent,
              textDecoration: "none",
            }}
          >
            {SECTIONS.find((section) => section.id === id)!.label}
          </Link>
        ))}
        <Footer data={data} />
      </Page>
      {data.includedSections.map((id) => (
        <Page key={id} size="LETTER" style={styles.page}>
          <Text id={id} style={styles.title}>
            {SECTIONS.find((section) => section.id === id)!.label}
          </Text>
          {id === "overview" ? (
            <Overview data={data} />
          ) : id === "chartBalance" ? (
            <BalanceLineChart data={data} />
          ) : id === "chartCategory" ? (
            <CategoryDonutChart data={data} />
          ) : id === "chartIncomeExpense" ? (
            <IncomeExpenseBarChart data={data} />
          ) : id === "chartGoals" ? (
            <GoalProgressBars data={data} />
          ) : id === "billsPaychecks" ? (
            <BillsPaychecksSection data={data} />
          ) : id === "forecastCalendar" ? (
            <ForecastCalendarSection data={data} />
          ) : id === "transactions" ? (
            <TransactionsSection data={data} />
          ) : id === "cardsRewards" ? (
            <CardsRewardsSection data={data} />
          ) : id === "advisorSolver" ? (
            <AdvisorSolverSection data={data} />
          ) : (
            <Text style={styles.caption}>
              No data available for this section.
            </Text>
          )}
          <Footer data={data} />
        </Page>
      ))}
    </Document>
  );
}
