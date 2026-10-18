"use client";
import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { clampedDate, dateParts, isISODate } from "@/lib/dates";
import {
  rangeLabel,
  resolveRange,
  validateRange,
} from "@/lib/reports/dateRange";
import type { ReportConfig, RangePreset } from "@/lib/reports/types";

// Date objects stay at the date picker's boundary; the model uses date-only strings.
function pickerDate(value: string) {
  if (!isISODate(value)) return undefined;
  const { year, month, day } = dateParts(value);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(12, 0, 0, 0);
  return date;
}
function CustomDate({
  label,
  value,
  today,
  onChange,
  invalid,
}: {
  label: string;
  value: string;
  today: string;
  onChange: (value: string) => void;
  invalid: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium" htmlFor={`report-${label}`}>
        {label} date
      </label>
      <div className="flex gap-1">
        <input
          id={`report-${label}`}
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={invalid}
          aria-describedby={invalid ? "report-range-error" : undefined}
          className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-2 text-sm"
        />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            render={
              <Button
                variant="outline"
                size="icon"
                className="h-10"
                aria-label={`Choose ${label.toLowerCase()} date`}
              />
            }
          >
            <CalendarDays aria-hidden />
          </PopoverTrigger>
          <PopoverContent className="w-auto" align="end">
            <PopoverTitle>{label} date</PopoverTitle>
            <Calendar
              mode="single"
              selected={pickerDate(value)}
              defaultMonth={pickerDate(value || today)}
              today={pickerDate(today)}
              onSelect={(date) => {
                if (date) {
                  onChange(
                    clampedDate(
                      date.getFullYear(),
                      date.getMonth() + 1,
                      date.getDate(),
                    ),
                  );
                  setOpen(false);
                }
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
export function DateRangePicker({
  config,
  today,
  onChange,
}: {
  config: ReportConfig;
  today: string;
  onChange: (config: ReportConfig) => void;
}) {
  const validation = validateRange(config.range);
  return (
    <fieldset className="space-y-3">
      <legend className="mb-2 text-sm font-semibold">Date range</legend>
      <label htmlFor="report-preset" className="sr-only">
        Range preset
      </label>
      <select
        id="report-preset"
        value={config.preset}
        className="w-full rounded-lg border border-border bg-background p-2.5 text-sm"
        onChange={(e) => {
          const preset = e.target.value as RangePreset;
          onChange({
            ...config,
            preset,
            range: resolveRange(preset, today, config.range),
          });
        }}
      >
        <option value="this-month">This month</option>
        <option value="last-month">Last month</option>
        <option value="this-year">This year</option>
        <option value="last-year">Last year</option>
        <option value="custom">Custom</option>
      </select>
      {config.preset === "custom" && (
        <div className="space-y-3">
          {(["start", "end"] as const).map((key) => (
            <CustomDate
              key={key}
              label={key === "start" ? "Start" : "End"}
              value={config.range[key]}
              today={today}
              invalid={!validation.valid}
              onChange={(value) =>
                onChange({
                  ...config,
                  range: { ...config.range, [key]: value },
                })
              }
            />
          ))}
        </div>
      )}
      {validation.valid ? (
        <p className="text-xs text-muted-foreground">
          {rangeLabel(config.range)} · inclusive
        </p>
      ) : (
        <p id="report-range-error" role="alert" className="text-sm text-neg">
          {validation.error}
        </p>
      )}
    </fieldset>
  );
}
