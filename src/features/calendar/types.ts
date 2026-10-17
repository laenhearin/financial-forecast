import type { Cents, ISODate } from "../big-purchase/types";

export type { Cents, ISODate };

export type BillPriority = "essential" | "important" | "optional";

/**
 * income, bill and planned (one-off expenses) are scheduled; estimate is the scenario's
 * everyday spending; purchase is something the user added on this page.
 */
export type EntryKind = "income" | "bill" | "planned" | "estimate" | "purchase";

export interface CalendarEntry {
  id: string;
  /** The bill, income source, or purchase this entry comes from. */
  sourceId: string;
  date: ISODate;
  kind: EntryKind;
  label: string;
  /** Positive; the kind gives the direction (only income adds money). */
  amountCents: Cents;
  accountId: string;
  recurring: boolean;
  priority?: BillPriority;
  /** Estimates only: the spending categories folded into this day's total. */
  detail?: string;
}

/** A user-added purchase saved locally for the active demo profile. */
export interface UserPurchase {
  id: string;
  label: string;
  amountCents: Cents;
  date: ISODate;
  accountId: string;
  recurring?: boolean;
  /** First date on which this series no longer posts. */
  cancelFromDate?: ISODate;
  /** Individual monthly occurrences removed from the series. */
  skippedDates?: ISODate[];
}

/** "all" or one account id. */
export type AccountView = string;
export const ALL_ACCOUNTS: AccountView = "all";

export interface DayBalance {
  totalCents: Cents;
  byAccount: Record<string, Cents>;
}

export type AdviceTone = "high" | "medium" | "ok" | "info";

export interface AdviceItem {
  id: string;
  title: string;
  tag: string;
  tone: AdviceTone;
  text: string;
  meta?: string;
}

export interface CreditCard {
  id: string;
  name: string;
  aprPercent: number;
  balanceCents: Cents;
  limitCents: Cents;
  rewards: string;
}
