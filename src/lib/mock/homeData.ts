import type { HomeData, ProjectionPoint } from "../../components/home/types";
import { USER_NAME } from "../config";
import { ROUTES } from "../navigation";

/** Fills every whole day between keyframes by straight-line interpolation, rounded to whole cents. */
export function interpolateDaily(keyframes: readonly ProjectionPoint[]): ProjectionPoint[] {
  const points: ProjectionPoint[] = [];
  for (let i = 0; i < keyframes.length - 1; i++) {
    const from = keyframes[i];
    const to = keyframes[i + 1];
    for (let day = from.day; day < to.day; day++) {
      const t = (day - from.day) / (to.day - from.day);
      points.push({ day, balanceCents: Math.round(from.balanceCents + (to.balanceCents - from.balanceCents) * t) });
    }
  }
  const last = keyframes.at(-1);
  if (last) points.push({ ...last });
  return points;
}

/** Hand-picked shape for the 30-day graph (sample data, not a forecast). */
const PROJECTION_KEYFRAMES: ProjectionPoint[] = [
  { day: 0, balanceCents: 234000 },
  { day: 5, balanceCents: 215500 },
  { day: 7, balanceCents: 86000 },
  { day: 10, balanceCents: 100000 },
  { day: 14, balanceCents: 197000 },
  { day: 17, balanceCents: 183000 },
  { day: 20, balanceCents: 12000 },
  { day: 23, balanceCents: 30500 },
  { day: 27, balanceCents: 215500 },
  { day: 30, balanceCents: 234000 },
];

export const homeData: HomeData = {
  isSampleData: true,
  userName: USER_NAME,
  todayWeather: "sunny",
  nextStormLabel: "Thursday",
  availableBalanceCents: 234000,
  projection: interpolateDaily(PROJECTION_KEYFRAMES),
  markers: [
    { day: 7, label: "Rent" },
    { day: 20, label: "Car + insurance" },
  ],
  cards: [
    {
      id: "thursday-collision",
      icon: "umbrella",
      tone: "rain",
      title: "Thursday collision",
      subtitle: "Rent + car payment",
      actionLabel: "Fix dates",
      href: ROUTES.stormSolver,
    },
    {
      id: "laptop-goal",
      icon: "target",
      tone: "accent",
      title: "Laptop goal",
      subtitle: "6 weeks away",
      actionLabel: "Speed up",
      href: ROUTES.bigPurchase,
    },
    {
      id: "cash-back",
      icon: "credit-card",
      tone: "sun",
      title: "Cash back",
      subtitle: "$18 missed this month",
      actionLabel: "See cards",
      href: ROUTES.cashBack,
    },
  ],
};
