export interface Account { id: string; name: string; balanceCents: number }
export interface ScheduledEvent {
  id: string;
  name: string;
  /** YYYY-MM-DD calendar date. */
  date: string;
  /** Positive integer cents; type determines direction. */
  amountCents: number;
  type: "income" | "expense";
}
export interface DailyForecast { date: string; closingBalanceCents: number; events: ScheduledEvent[] }
export interface HypotheticalPurchase { name: string; date: string; amountCents: number }
