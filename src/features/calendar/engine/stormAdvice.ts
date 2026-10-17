import { daysBetween, formatDate } from "../../../lib/dates";
import { formatUSD } from "../../../lib/money";
import { FORECAST_DAYS, MAX_ADVICE_BILLS } from "../config";
import { plural } from "../format";
import type { AdviceItem, AdviceTone, BillPriority, CalendarEntry, Cents } from "../types";
import type { CalendarModel } from "./model";

const PRIORITY_RANK: Record<BillPriority, number> = { essential: 0, important: 1, optional: 2 };
const PRIORITY_NAME: Record<BillPriority, string> = { essential: "Essential", important: "Important", optional: "Optional" };
const PRIORITY_TONE: Record<BillPriority, AdviceTone> = { essential: "high", important: "medium", optional: "ok" };
const PRIORITY_TEXT: Record<BillPriority, string> = {
  essential:
    "Prioritize this payment to protect housing, utilities, or essential access. Check the actual due date and make sure the payment arrives on time.",
  important:
    "Plan for this bill after essential expenses and required debt minimums. Keep enough cash available for necessities and any upcoming automatic withdrawals.",
  optional:
    "This is a discretionary expense. If cash is tight, consider pausing or canceling it rather than delaying an essential bill or a required minimum payment.",
};

/** The next due date of each bill in the forecast window, essential first, then by date. */
export function nextBills(model: CalendarModel): CalendarEntry[] {
  const next = new Map<string, CalendarEntry>();
  for (const entry of model.entries) {
    if (entry.kind !== "bill" || entry.date < model.asOfDate || entry.date > model.forecastEnd) continue;
    if (!next.has(entry.sourceId)) next.set(entry.sourceId, entry);
  }
  const rank = (e: CalendarEntry) => PRIORITY_RANK[e.priority ?? "important"];
  return [...next.values()].sort((a, b) => rank(a) - rank(b) || (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Advice only: which bills to prioritize, timing around income, and the cash buffer. Changes nothing. */
export function stormAdvice(model: CalendarModel, accountNames: Record<string, string>, bufferCents: Cents): AdviceItem[] {
  const items: AdviceItem[] = [];
  const bills = nextBills(model);
  const short = (date: string) => formatDate(date, "short");

  if (bills.length === 0) {
    items.push({
      id: "no-bills",
      title: "No upcoming unpaid bills",
      tag: "Good",
      tone: "ok",
      text: `There are no unpaid bill entries in the current ${FORECAST_DAYS}-day view. Make sure your bill list is complete.`,
    });
  }
  for (const bill of bills.slice(0, MAX_ADVICE_BILLS)) {
    const priority = bill.priority ?? "important";
    const dueIn = daysBetween(model.asOfDate, bill.date);
    items.push({
      id: `bill-${bill.sourceId}`,
      title: bill.label,
      tag: PRIORITY_NAME[priority],
      tone: PRIORITY_TONE[priority],
      text:
        dueIn === 0
          ? "This bill is due today in the Nessie data. Confirm the real due date and payment status, and pay on time if possible."
          : `${PRIORITY_TEXT[priority]} It is scheduled in ${plural(dueIn, "day")} (${short(bill.date)}).`,
      meta: `${formatUSD(bill.amountCents)} · ${accountNames[bill.accountId] ?? "Account"} · next due ${short(bill.date)}`,
    });
  }

  const nextIncome = model.entries.find((e) => e.kind === "income" && e.date >= model.asOfDate && e.date <= model.forecastEnd);
  if (nextIncome) {
    const days = daysBetween(model.asOfDate, nextIncome.date);
    items.push({
      id: "income-timing",
      title: "Plan around incoming money",
      tag: "Timing",
      tone: "info",
      text: `Your next listed incoming payment is ${nextIncome.label} for ${formatUSD(nextIncome.amountCents)} on ${short(nextIncome.date)}. Compare bills due before that date against your available cash. Do not assume money will arrive until it is confirmed.`,
      meta: days === 0 ? "Listed income is scheduled for today. Verify that it has arrived." : `Scheduled in ${plural(days, "day")}.`,
    });
  } else {
    items.push({
      id: "income-timing",
      title: "Check your income schedule",
      tag: "Timing",
      tone: "medium",
      text: "No future income was found in the current account view. Add expected paychecks and other reliable income so the forecast can provide more useful timing guidance.",
      meta: "Forecast quality depends on complete, realistic income entries.",
    });
  }

  let firstLow: { date: string; accountIds: string[] } | null = null;
  for (const [date, { byAccount }] of model.balances) {
    const low = model.accountIds.filter((id) => byAccount[id] < bufferCents);
    if (low.length) {
      firstLow = { date, accountIds: low };
      break;
    }
  }
  if (firstLow) {
    const names = firstLow.accountIds.map((id) => accountNames[id] ?? id).join(", ");
    items.push({
      id: "buffer",
      title: "Protect your cash buffer",
      tag: "Watch balance",
      tone: "high",
      text: `The forecast first shows at least one selected account below your ${formatUSD(bufferCents)} buffer on ${short(firstLow.date)}. Affected account(s): ${names}. Review discretionary purchases, confirm pending income, and check whether bill providers allow a due-date change that still keeps you on time.`,
      meta: "This is a forecast based on Nessie sandbox balances and bills, with estimated income and spending. It does not account for unentered transactions, holds, fees, or provider processing delays.",
    });
  } else {
    items.push({
      id: "buffer",
      title: "Your cash buffer",
      tag: "Looks okay",
      tone: "ok",
      text: `No selected account is projected to fall below ${formatUSD(bufferCents)} in the current ${FORECAST_DAYS}-day forecast. Keep monitoring balances and leave room for unexpected expenses.`,
      meta: "A positive forecast is not a guarantee that funds will be available.",
    });
  }

  const essential = bills.filter((b) => b.priority === "essential").length;
  const optional = bills.filter((b) => b.priority === "optional").length;
  items.push({
    id: "order",
    title: "Suggested order of operations",
    tag: "Priority guide",
    tone: "info",
    text: "1. Cover necessities and essential bills. 2. Make at least the required minimum payment on every credit card and loan by its due date. 3. Address overdue bills and high-interest debt. 4. Make extra debt payments when essentials and minimums are covered. 5. Fund discretionary spending last.",
    meta: `${plural(essential, "essential bill")} and ${plural(optional, "optional bill")} found in the current view. This is a general framework; urgent legal, housing, utility, or account-specific circumstances may change the order.`,
  });

  return items;
}
