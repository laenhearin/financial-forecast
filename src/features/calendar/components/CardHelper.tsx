"use client";

import { useRef, useState, type FormEvent } from "react";
import { parseDollarsToCents } from "@/lib/money";
import { CARD_NAME_MAX_LENGTH, CARD_REWARDS_MAX_LENGTH } from "../config";
import { cardSummary, compareCards } from "../engine/cardAdvice";
import type { AdviceItem, CreditCard } from "../types";
import { AdviceList } from "./AdviceList";
import { inputClass, labelClass, noteClass, primaryButtonClass, removeButtonClass, subtitleClass } from "./ui";

const EMPTY_FORM = { name: "", apr: "", balance: "", limit: "", rewards: "" };

/** Compares cards the user types in. Never asks for card numbers; nothing is saved. */
export function CardHelper() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [planned, setPlanned] = useState("");
  const [advice, setAdvice] = useState<AdviceItem[]>([]);
  const nextId = useRef(1);

  const field = (key: keyof typeof EMPTY_FORM) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  function addCard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = form.name.trim();
    const aprPercent = Number(form.apr);
    const balanceCents = parseDollarsToCents(form.balance);
    const limitCents = parseDollarsToCents(form.limit);
    if (!name || form.apr.trim() === "" || !Number.isFinite(aprPercent) || aprPercent < 0 || aprPercent > 100 || balanceCents === null || limitCents === null || limitCents < 100) {
      setError("Enter a card name, an APR from 0 to 100, a balance of $0 or more, and a credit limit of at least $1.");
      return;
    }
    setCards((list) => [...list, { id: `card-${nextId.current++}`, name, aprPercent, balanceCents, limitCents, rewards: form.rewards.trim() }]);
    setForm(EMPTY_FORM);
    setError(null);
  }

  function removeCard(id: string) {
    setCards((list) => list.filter((card) => card.id !== id));
    setAdvice([]);
  }

  return (
    <div>
      <h3 className="text-body font-semibold text-primary">Credit card helper</h3>
      <p className={subtitleClass}>Compare cards before choosing one</p>
      <p className="mt-3 mb-4 text-caption text-secondary">
        Enter your card details to compare APR, utilization, available credit, and rewards. The recommendation is an estimate, not a guarantee of approval or savings.
      </p>

      <form onSubmit={addCard} noValidate className="flex flex-col gap-3">
        <div>
          <label htmlFor="card-name" className={labelClass}>
            Card name
          </label>
          <input id="card-name" maxLength={CARD_NAME_MAX_LENGTH} placeholder="e.g. Everyday Rewards" className={inputClass} {...field("name")} />
        </div>
        <div>
          <label htmlFor="card-apr" className={labelClass}>
            Purchase APR (%)
          </label>
          <input id="card-apr" type="number" inputMode="decimal" min="0" max="100" step="0.01" placeholder="e.g. 24.99" className={inputClass} {...field("apr")} />
        </div>
        <div>
          <label htmlFor="card-balance" className={labelClass}>
            Current card balance ($)
          </label>
          <input id="card-balance" type="number" inputMode="decimal" min="0" step="0.01" placeholder="e.g. 350" className={inputClass} {...field("balance")} />
        </div>
        <div>
          <label htmlFor="card-limit" className={labelClass}>
            Credit limit ($)
          </label>
          <input id="card-limit" type="number" inputMode="decimal" min="1" step="0.01" placeholder="e.g. 2000" className={inputClass} {...field("limit")} />
        </div>
        <div>
          <label htmlFor="card-rewards" className={labelClass}>
            Rewards (optional)
          </label>
          <input id="card-rewards" maxLength={CARD_REWARDS_MAX_LENGTH} placeholder="e.g. 2% cash back" className={inputClass} {...field("rewards")} />
        </div>
        {error && (
          <p role="alert" className="text-caption text-neg">
            {error}
          </p>
        )}
        <button type="submit" className={primaryButtonClass}>
          + Add my card
        </button>
      </form>

      <ul className="my-3 flex flex-col gap-2">
        {cards.length === 0 ? (
          <li className="py-3 text-caption text-secondary">No cards added yet. Enter each card&apos;s APR, balance, and limit above to compare them.</li>
        ) : (
          cards.map((card) => (
            <li key={card.id} className="flex items-start justify-between gap-2.5 rounded-item border border-app p-3">
              <div className="min-w-0">
                <p className="text-caption font-semibold text-primary">{card.name}</p>
                <p className="mt-1 text-micro text-secondary">{cardSummary(card)}</p>
              </div>
              <button type="button" onClick={() => removeCard(card.id)} aria-label={`Remove ${card.name}`} className={removeButtonClass}>
                Remove
              </button>
            </li>
          ))
        )}
      </ul>

      <hr className="my-5 border-app" />
      <h3 className="mb-3 text-body font-semibold text-primary">Compare cards for a purchase</h3>
      <div>
        <label htmlFor="planned-amount" className={labelClass}>
          Planned purchase amount ($)
        </label>
        <input id="planned-amount" type="number" inputMode="decimal" min="0.01" step="0.01" placeholder="e.g. 80" value={planned} onChange={(e) => setPlanned(e.target.value)} className={inputClass} />
      </div>
      <button type="button" onClick={() => setAdvice(compareCards(cards, parseDollarsToCents(planned)))} className={`${primaryButtonClass} mt-3`}>
        Recommend a card
      </button>
      <div aria-live="polite">
        <AdviceList items={advice} />
      </div>
      <p className={noteClass}>
        General guidance only. Interest rates, fees, statement closing dates, promotional terms, and issuer rules can change the best choice. If you carry a balance, paying it down and avoiding new interest-bearing debt is usually more important than earning rewards.
      </p>
    </div>
  );
}
