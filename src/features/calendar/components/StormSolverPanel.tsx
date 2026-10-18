"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { DEFAULT_BUFFER_DOLLARS } from "../config";
import type { AdviceItem } from "../types";
import { AdviceList } from "./AdviceList";
import { CardHelper } from "./CardHelper";
import { inputClass, labelClass, panelClass, panelTitleClass, primaryButtonClass, subtitleClass } from "./ui";

export interface StormState {
  tone: "neutral" | "success" | "warning";
  message: string;
  items: AdviceItem[];
}

const STATUS_BG: Record<StormState["tone"], string> = { neutral: "bg-accent-soft", success: "bg-pos-soft", warning: "bg-rain-soft" };

/** Advice only: it never changes dates or makes payments. */
export function StormSolverPanel({ storm, onAnalyze }: { storm: StormState; onAnalyze: (bufferDollars: string) => void }) {
  const [buffer, setBuffer] = useState(DEFAULT_BUFFER_DOLLARS);

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.4fr)]">
    <section aria-labelledby="storm-title" className={panelClass}>
      <div className="flex items-center gap-3">
        <span aria-hidden className="grid size-11.5 shrink-0 place-items-center rounded-panel bg-rain-soft text-2xl">
          ⛈️
        </span>
        <div>
          <h2 id="storm-title" className={panelTitleClass}>
            Storm Solver
          </h2>
          <p className={subtitleClass}>Advice for calmer cash flow</p>
        </div>
      </div>
      <p className="mt-3 mb-4.5 text-caption text-secondary">
        Get recommendations on which payments to prioritize, when to schedule payments around income, and which credit card may fit a purchase. Storm Solver provides advice only: it never changes your dates or makes payments for you.
      </p>

      <label htmlFor="storm-buffer" className={labelClass}>
        Minimum cash buffer you want to keep ($)
      </label>
      <input id="storm-buffer" type="number" inputMode="decimal" min="0" step="25" value={buffer} onChange={(e) => setBuffer(e.target.value)} className={inputClass} />
      <button type="button" onClick={() => onAnalyze(buffer)} className={`${primaryButtonClass} mt-3`}>
        ⛈️ Get my payment advice
      </button>
      <p role="status" className={cn("mt-3.5 rounded-item px-3 py-3 text-caption text-primary", STATUS_BG[storm.tone])}>
        {storm.message}
      </p>
      <AdviceList items={storm.items} />

    </section>
    <section aria-label="Credit card helper" className={panelClass}>
      <CardHelper />
    </section>
    </div>
  );
}
