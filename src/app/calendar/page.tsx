import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/ComingSoon";

export const metadata: Metadata = { title: "Calendar · Financial Forecast" };

export default function CalendarPage() {
  return <ComingSoon title="Calendar" />;
}
