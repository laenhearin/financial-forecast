"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { centsToInputString, parseDollarsToCents } from "@/lib/money";
import { inputClass } from "./ui";

interface MoneyInputProps {
  id: string;
  /** null shows an empty field. */
  value: number | null;
  onChange: (cents: number | null) => void;
  placeholder?: string;
  invalid?: boolean;
  describedBy?: string;
  disabled?: boolean;
  className?: string;
}

/** Dollar text field that reports integer cents; keeps partial typing like "12." intact. */
export function MoneyInput({ id, value, onChange, placeholder, invalid, describedBy, disabled, className }: MoneyInputProps) {
  const [draft, setDraft] = useState(value === null ? "" : centsToInputString(value));
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    // The value changed from outside (stepper, reset): show it unless the draft already means it.
    setLastValue(value);
    const draftCents = draft.trim() === "" ? null : parseDollarsToCents(draft);
    if (draftCents !== value) setDraft(value === null ? "" : centsToInputString(value));
  }
  const unparseable = draft.trim() !== "" && parseDollarsToCents(draft) === null;

  return (
    <div className={cn("relative", className)}>
      <span aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-(--bp-muted)">$</span>
      <Input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        value={draft}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={invalid || unparseable || undefined}
        aria-describedby={describedBy}
        className={cn(inputClass, "pl-7")}
        onChange={event => {
          const text = event.target.value;
          setDraft(text);
          if (text.trim() === "") onChange(null);
          else {
            const cents = parseDollarsToCents(text);
            if (cents !== null) onChange(cents);
          }
        }}
      />
      {unparseable && <p className="mt-1 text-xs text-(--bp-danger-ink)">Enter dollars, like 1800 or 15.49.</p>}
    </div>
  );
}
