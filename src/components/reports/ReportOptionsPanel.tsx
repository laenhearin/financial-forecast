"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { validateRange } from "@/lib/reports/dateRange";
import {
  includedSections,
  SECTIONS,
  sectionAvailability,
} from "@/lib/reports/sections";
import type { ReportConfig } from "@/lib/reports/types";
import { DateRangePicker } from "./DateRangePicker";

export function ReportOptionsPanel({
  config,
  today,
  onChange,
  onGenerate,
  generating = false,
  stale = false,
  dataError,
}: {
  config: ReportConfig;
  today: string;
  onChange: (config: ReportConfig) => void;
  onGenerate: () => void;
  generating?: boolean;
  stale?: boolean;
  dataError?: string;
}) {
  const availability = sectionAvailability(config, today);
  const noSections = includedSections(config, today).length === 0;
  return (
    <Card className="self-start">
      <CardContent className="space-y-6">
        <DateRangePicker config={config} today={today} onChange={onChange} />
        <fieldset className="space-y-3">
          <legend className="mb-2 text-sm font-semibold">
            Include in your report
          </legend>
          <div className="flex gap-3 text-xs">
            <button
              type="button"
              className="underline underline-offset-4"
              onClick={() =>
                onChange({
                  ...config,
                  sections: {
                    ...config.sections,
                    ...Object.fromEntries(
                      SECTIONS.map(({ id }) => [
                        id,
                        availability[id].available,
                      ]),
                    ),
                  },
                })
              }
            >
              Select all
            </button>
            <button
              type="button"
              className="underline underline-offset-4"
              onClick={() =>
                onChange({
                  ...config,
                  sections: {
                    ...config.sections,
                    ...Object.fromEntries(
                      SECTIONS.map(({ id }) => [id, false]),
                    ),
                  },
                })
              }
            >
              Clear all
            </button>
          </div>
          {SECTIONS.map(({ id, label }) => {
            const available = availability[id];
            return (
              <div key={id}>
                {id === "chartBalance" && (
                  <p className="mb-3 mt-5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Charts
                  </p>
                )}
                {id === "billsPaychecks" && (
                  <div className="mb-4 mt-4 border-t border-border" />
                )}
                <label
                  className={`flex items-start gap-2.5 text-sm ${!available.available ? "text-muted-foreground" : ""}`}
                >
                  <Checkbox
                    checked={config.sections[id] && available.available}
                    disabled={!available.available}
                    onCheckedChange={(checked) =>
                      onChange({
                        ...config,
                        sections: { ...config.sections, [id]: checked },
                      })
                    }
                    aria-describedby={
                      !available.available ? `help-${id}` : undefined
                    }
                  />
                  {label}
                </label>
                {!available.available && (
                  <p
                    id={`help-${id}`}
                    className="ml-6 mt-1 text-xs text-muted-foreground"
                  >
                    {available.reason}
                  </p>
                )}
                {id === "overview" && config.sections.overview && (
                  <label className="ml-6 mt-2 flex gap-2 text-xs text-muted-foreground">
                    <Checkbox
                      checked={config.compareToPrevious}
                      onCheckedChange={(compareToPrevious) =>
                        onChange({ ...config, compareToPrevious })
                      }
                    />
                    Compare to previous period
                  </label>
                )}
              </div>
            );
          })}
        </fieldset>
        {noSections && (
          <p role="alert" className="text-sm text-neg">
            Select at least one section
          </p>
        )}
        {dataError && (
          <p role="alert" className="text-sm text-neg">
            {dataError}
          </p>
        )}
        <Button
          className="h-11 w-full"
          disabled={
            generating ||
            !validateRange(config.range).valid ||
            noSections ||
            Boolean(dataError)
          }
          onClick={onGenerate}
        >
          {generating
            ? "Generating…"
            : stale
              ? "Regenerate"
              : "Generate report"}
        </Button>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Letter PDF · Account numbers masked · Settings reset when you leave
          this page.
        </p>
      </CardContent>
    </Card>
  );
}
