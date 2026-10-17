/**
 * Data contract for the Home page. lib/mock/homeData.ts fills it today; the forecast engine
 * replaces that one file later without component changes. Money is integer cents.
 */
export type Weather = "sunny" | "cloudy" | "rainy" | "downpour";

export interface ProjectionPoint {
  day: number;
  balanceCents: number;
}

export interface BillMarker {
  day: number;
  label: string;
}

export interface CardData {
  id: string;
  icon: "umbrella" | "target" | "credit-card";
  tone: "rain" | "accent" | "sun";
  title: string;
  subtitle: string;
  actionLabel: string;
  href: string;
}

export interface HomeData {
  /** Calendar date for day zero of the projection. */
  asOfDate: string;
  /** True while the page shows fixtures; the page labels them as sample data. */
  isSampleData: boolean;
  userName: string;
  nextStormLabel: string | null;
  availableBalanceCents: number;
  /** One point per day, day 0 (today) to day 30. */
  projection: ProjectionPoint[];
  markers: BillMarker[];
  cards: CardData[];
}
