import type { DailyForecast, ScheduledEvent } from "./types";

function parseDate(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error("Use a valid YYYY-MM-DD calendar date.");
  }
  return date;
}

/** Opening balance on startDate; events must exclude transactions already in that balance. */
export function forecastBalance(startingBalanceCents: number, startDate: string, days: number, events: ScheduledEvent[]): DailyForecast[] {
  if (!Number.isSafeInteger(startingBalanceCents)) throw new Error("Balance must be safe integer cents.");
  if (!Number.isInteger(days) || days < 1 || days > 366) throw new Error("Forecast must span 1 to 366 days.");
  const cursor = parseDate(startDate);
  for (const event of events) {
    parseDate(event.date);
    if (!Number.isSafeInteger(event.amountCents) || event.amountCents < 0) throw new Error("Amounts must be nonnegative safe integer cents.");
    if (event.type !== "income" && event.type !== "expense") throw new Error("Unknown event type.");
  }
  let balance = startingBalanceCents;
  return Array.from({ length: days }, () => {
    const date = cursor.toISOString().slice(0, 10);
    const dailyEvents = events.filter(event => event.date === date);
    for (const event of dailyEvents) {
      balance += event.type === "income" ? event.amountCents : -event.amountCents;
      if (!Number.isSafeInteger(balance)) throw new Error("Balance exceeds supported range.");
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    return { date, closingBalanceCents: balance, events: dailyEvents };
  });
}
