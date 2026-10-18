import { Text, View } from "@react-pdf/renderer";
import { formatUSD } from "@/lib/money";
import type { ReportData } from "@/lib/reports/types";
import { colors, styles } from "./theme";
export function TransactionsSection({ data }: { data: ReportData }) {
  const transactions = data.transactions;
  if (!transactions?.rows.length)
    return (
      <Text style={styles.caption}>
        No recorded transactions for this period.
      </Text>
    );
  return (
    <>
      <Text style={[styles.caption, { marginBottom: 12 }]}>
        Completed deposits and withdrawals only. Merchant descriptions and
        keyword categories may be incomplete. Mask **** means the source
        supplies no account number.
      </Text>
      <View
        style={[
          styles.row,
          {
            backgroundColor: colors.pale,
            fontFamily: "Helvetica-Bold",
            fontSize: 8,
          },
        ]}
        wrap={false}
      >
        {["Date", "Description", "Category", "Account", "Amount"].map(
          (label, i) => (
            <Text key={label} style={{ width: [68, 170, 88, 114, 80][i] }}>
              {label}
            </Text>
          ),
        )}
      </View>
      {transactions.rows.map((row, i) => (
        <View
          key={i}
          wrap={false}
          style={[
            styles.row,
            { fontSize: 8, backgroundColor: i % 2 ? colors.pale : "#ffffff" },
          ]}
        >
          <Text style={{ width: 68 }}>{row.date}</Text>
          <Text style={{ width: 170, paddingRight: 8 }}>{row.label}</Text>
          <Text style={{ width: 88, paddingRight: 8 }}>{row.category}</Text>
          <Text style={{ width: 114, paddingRight: 8 }}>
            {row.accountLabel}
          </Text>
          <Text style={{ width: 80, textAlign: "right" }}>
            {formatUSD(
              row.direction === "in" || row.kind === "income"
                ? row.amountCents
                : -row.amountCents,
            )}
          </Text>
        </View>
      ))}
      {transactions.truncated && (
        <Text style={styles.caption}>
          Showing the first 1,000 of {transactions.totalCount} transactions.
          Overview totals and charts still include all recorded activity in the
          period.
        </Text>
      )}
    </>
  );
}
export function CardsRewardsSection({ data }: { data: ReportData }) {
  const cards = data.cards ?? [];
  if (!cards.length)
    return <Text style={styles.caption}>No credit cards selected yet.</Text>;
  return (
    <>
      <Text style={styles.paragraph}>
        Current card lineup from Swipe and Shine. The feed does not provide
        card-level purchases or account numbers, so historical spend and rewards
        are unavailable. Cash withdrawals are not assigned to cards. ****
        indicates no number supplied.
      </Text>
      {cards.map((card, i) => (
        <View
          key={i}
          wrap={false}
          style={[styles.row, { flexDirection: "column", gap: 5 }]}
        >
          <Text style={{ fontFamily: "Helvetica-Bold" }}>
            {card.name} {card.maskedNumber}
          </Text>
          <Text>
            Spend:{" "}
            {card.spendCents === null
              ? "Unavailable"
              : formatUSD(card.spendCents)}
          </Text>
          {card.rewardsEarnedCents !== undefined &&
            card.rewardsIfOptimalCents !== undefined && (
              <Text>
                Rewards: {formatUSD(card.rewardsEarnedCents)} · If optimal:{" "}
                {formatUSD(card.rewardsIfOptimalCents)} · Difference:{" "}
                {formatUSD(
                  card.rewardsIfOptimalCents - card.rewardsEarnedCents,
                )}
              </Text>
            )}
        </View>
      ))}
    </>
  );
}
export function AdvisorSolverSection({ data }: { data: ReportData }) {
  const results = data.advisorSolver;
  return (
    <>
      <Text style={styles.subtitle}>Purchase Advisor</Text>
      <Text style={styles.caption}>
        Saved hypothetical purchases in this period, recalculated against
        today&apos;s scenario and other saved purchases. These are current
        estimates, not stored past verdicts or recorded transactions. Recurring
        items use their next occurrence in the selected range.
      </Text>
      {!results?.advisorScenarios.length ? (
        <Text style={styles.caption}>
          No saved future purchase scenarios in this period. Unsaved checks and
          past verdicts are not recorded.
        </Text>
      ) : (
        results.advisorScenarios.map((scenario, i) => (
          <View
            key={i}
            wrap={false}
            style={[styles.row, { flexDirection: "column", gap: 5 }]}
          >
            <Text style={{ fontFamily: "Helvetica-Bold" }}>
              {scenario.itemName} · {formatUSD(scenario.costCents)} ·{" "}
              {scenario.date}
            </Text>
            <Text>{scenario.verdict}</Text>
            <Text style={styles.caption}>
              Lowest projected balance: {formatUSD(scenario.lowestBalanceCents)}
            </Text>
          </View>
        ))
      )}
      <Text style={styles.subtitle}>Storm Solver</Text>
      <Text style={styles.caption}>
        No saved bill-date changes or before/after risk results are available.
        Nessie bills carry no flexibility information. Current guidance below
        uses the existing 90-day baseline forecast; it changes no bills.
      </Text>
      {results?.guidance.length ? (
        results.guidance.map((text, i) => (
          <Text key={i} style={[styles.paragraph, { marginTop: 12 }]}>
            {text}
          </Text>
        ))
      ) : (
        <Text style={styles.caption}>
          No forecast guidance for a fully past period.
        </Text>
      )}
    </>
  );
}
