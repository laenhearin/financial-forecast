"use client";

import { useMemo, useState } from "react";
import { Database } from "lucide-react";
import { parseDollarsToCents } from "@/lib/money";
import type { Scenario } from "../../big-purchase/types";
import { scenarioEntries } from "../engine/entries";
import { buildCalendarModel } from "../engine/model";
import { stormAdvice } from "../engine/stormAdvice";
import { ALL_ACCOUNTS } from "../types";
import { StormSolverPanel, type StormState } from "./StormSolverPanel";

const READY: StormState = {
  tone: "neutral",
  message: "Ready to review your bills, projected balance, and upcoming income.",
  items: [],
};

export function StormSolverApp({ scenario, sourceLabel, isFixture }: { scenario: Scenario; sourceLabel: string; isFixture: boolean }) {
  const [storm, setStorm] = useState<StormState>(READY);
  const entries = useMemo(() => scenarioEntries(scenario), [scenario]);
  const model = useMemo(() => buildCalendarModel(scenario, [], ALL_ACCOUNTS, entries), [scenario, entries]);
  const accountNames = useMemo(() => Object.fromEntries(scenario.accounts.map((account) => [account.id, account.nickname])), [scenario]);

  function analyze(bufferDollars: string) {
    const bufferCents = parseDollarsToCents(bufferDollars);
    if (bufferCents === null) {
      setStorm({ tone: "warning", message: "Enter a valid cash buffer of $0 or more.", items: [] });
      return;
    }
    setStorm({
      tone: "success",
      message: "Advice generated from the current demo forecast. Nothing has been rescheduled, paid, or changed.",
      items: stormAdvice(model, accountNames, bufferCents),
    });
  }

  return (
    <div className="mx-auto w-full max-w-300 px-5 py-12 md:px-10">
      <header className="mb-7">
        <h1 className="text-display font-medium text-primary">Storm Solver</h1>
        <p className="mt-1.5 text-caption text-secondary">Review upcoming bills, your projected balance, and ways to prepare for tight spots.</p>
        {isFixture && (
          <p className="mt-2 flex items-start gap-1.5 text-caption text-secondary">
            <Database aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
            {sourceLabel}: {scenario.customerName}, {scenario.label.toLowerCase()} scenario. Not live bank data; recommendations use the combined account forecast.
          </p>
        )}
      </header>
      <div className="max-w-3xl">
        <StormSolverPanel storm={storm} onAnalyze={analyze} />
      </div>
    </div>
  );
}
