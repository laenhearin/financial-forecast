"use client";

import { CircleCheck, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { addDays, formatDate, fromDayNumber, maxDate, minDate, toDayNumber } from "@/lib/dates";
import { DEADLINE_MIN_OFFSET_DAYS } from "../config";
import type { Forecast } from "../types";
import { Bounce } from "./motion";
import { cardClass, mutedTextClass, primaryButtonClass } from "./ui";

interface DeadlineSliderProps {
  forecast: Forecast;
  deadline: string;
  needsHelp: boolean;
  onChange: (date: string) => void;
  onHelp: () => void;
}

/** Preferred deadline from a week after today to the horizon end, in one-day steps. */
export function DeadlineSlider({ forecast, deadline, needsHelp, onChange, onHelp }: DeadlineSliderProps) {
  const min = addDays(forecast.asOfDate, DEADLINE_MIN_OFFSET_DAYS);
  const max = forecast.horizonEndDate;
  const value = maxDate(min, minDate(max, deadline));
  return (
    <section aria-labelledby="bp-deadline-heading" className={`${cardClass} space-y-5 p-6`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="bp-deadline-heading" className="font-semibold">Preferred deadline</h3>
        <p className="text-lg font-semibold text-(--bp-primary-ink)">{formatDate(value, "full")}</p>
      </div>
      <Slider
        aria-labelledby="bp-deadline-heading"
        min={toDayNumber(min)}
        max={toDayNumber(max)}
        step={1}
        value={[toDayNumber(value)]}
        onValueChange={next => onChange(fromDayNumber(Array.isArray(next) ? next[0] : next))}
        getAriaValueText={(_, dayNumber) => formatDate(fromDayNumber(dayNumber), "full")}
        className="py-2 **:data-[slot=slider-range]:bg-(--bp-primary) **:data-[slot=slider-thumb]:size-5 **:data-[slot=slider-thumb]:border-2 **:data-[slot=slider-thumb]:border-(--bp-primary-ink) **:data-[slot=slider-track]:h-2 **:data-[slot=slider-track]:bg-(--bp-line)"
      />
      <div className={`flex justify-between text-xs ${mutedTextClass}`}>
        <span>{formatDate(min, "short")}</span>
        <span>{formatDate(max, "full")}</span>
      </div>
      {needsHelp ? (
        <Bounce>
          <Button className={primaryButtonClass} onClick={onHelp}><Target aria-hidden /> Help me get there</Button>
        </Bounce>
      ) : (
        <p className="inline-flex min-h-9 items-center gap-2 rounded-full bg-(--bp-mint) px-4 text-sm font-semibold text-(--bp-ink)">
          <CircleCheck aria-hidden className="size-4" /> You&apos;re on track
        </p>
      )}
    </section>
  );
}
