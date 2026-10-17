/**
 * Data contract for the Home page. Values are mapped from the active Nessie customer on the server.
 * Money is integer cents.
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
  userName: string;
  nextStormLabel: string | null;
  availableBalanceCents: number;
  /** One point per day, day 0 (today) to day 30. */
  projection: ProjectionPoint[];
  markers: BillMarker[];
  cards: CardData[];
}
