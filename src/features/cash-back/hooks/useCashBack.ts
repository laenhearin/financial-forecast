"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { AdviceResponse, CategorizeResponse } from "../ai/api";
import { buildAdviceFacts } from "../ai/facts";
import { templateNarration } from "../ai/narrator";
import { cardsByIds, findCard } from "../cards/library";
import { MAX_AI_MERCHANTS } from "../config";
import { CashBackLoadError, demoCashBackSource, type CashBackData, type CashBackDataSource } from "../data/source";
import { analyzeCashBack } from "../engine/analyze";
import { categorize, categorizeByKeyword, unmatchedMerchants } from "../engine/categorize";
import { lookupPurchase } from "../engine/playbook";
import { actualCapLedger } from "../engine/rewards";
import { prefsStore, sameSelection, toggleCard } from "../state/prefsStore";
import { isCategory, type Category, type CategorySource, type Cents, type WindowDays } from "../types";

// Choose the data source here. nessieCashBackSource is a stub: the Nessie API has no purchase-list endpoint yet.
const dataSource: CashBackDataSource = demoCashBackSource;

type DataState =
  | { status: "loading" }
  | { status: "error"; message: string; details: string[] }
  | { status: "ready"; data: CashBackData };

export type AiCategorizeState =
  | { status: "idle" | "loading" }
  | { status: "done"; categories: Record<string, Category>; requested: string[] }
  | { status: "unavailable" | "error"; message: string; requested: string[] };

export type AiAdviceState =
  | { status: "idle" | "loading" }
  | { status: "done"; response: AdviceResponse; factsKey: string };

export interface LookupQuery {
  merchant: string;
  category: Category;
  categorySource: CategorySource | "chosen";
  amountCents: Cents;
}

async function postJson<T>(url: string, body: unknown): Promise<{ httpStatus: number; data: T | null }> {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  let data: T | null = null;
  try {
    data = (await response.json()) as T;
  } catch {
    data = null;
  }
  return { httpStatus: response.status, data };
}

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function useCashBack() {
  const [dataState, setDataState] = useState<DataState>({ status: "loading" });
  useEffect(() => {
    let live = true;
    dataSource.load().then(
      data => { if (live) setDataState({ status: "ready", data }); },
      (error: unknown) => {
        if (!live) return;
        setDataState({
          status: "error",
          message: messageOf(error, "The purchase data could not be loaded."),
          details: error instanceof CashBackLoadError ? error.details : [],
        });
      },
    );
    return () => { live = false; };
  }, []);
  const data = dataState.status === "ready" ? dataState.data : null;

  const prefs = useSyncExternalStore(prefsStore.subscribe, prefsStore.getSnapshot, prefsStore.getServerSnapshot);
  const hydrated = prefs !== null;
  const defaultCardIds = useMemo(() => data?.ownedCardIds ?? [], [data]);
  const selectedCardIds = useMemo(() => prefs?.selectedCardIds ?? defaultCardIds, [prefs, defaultCardIds]);
  const windowDays: WindowDays = prefs?.windowDays ?? 90;
  const showSuggestion = prefs?.showSuggestion ?? true;

  // Keyword matching runs locally; only the unmatched merchants go to the AI route, once per load.
  const unmatched = useMemo(() => (data ? unmatchedMerchants(data.purchases).slice(0, MAX_AI_MERCHANTS) : []), [data]);
  const [aiCategorize, setAiCategorize] = useState<AiCategorizeState>({ status: "idle" });
  useEffect(() => {
    if (unmatched.length === 0) return;
    let live = true;
    // Deferred so the state change happens in a callback, not synchronously in the effect body.
    const timer = setTimeout(() => {
      setAiCategorize({ status: "loading" });
      postJson<CategorizeResponse>("/api/cash-back/categorize", { merchants: unmatched }).then(
        ({ httpStatus, data: body }) => {
          if (!live) return;
          if (body?.status === "ok") setAiCategorize({ status: "done", categories: body.categories, requested: unmatched });
          else if (body?.status === "unavailable") setAiCategorize({ status: "unavailable", message: body.message, requested: unmatched });
          else setAiCategorize({ status: "error", message: body?.message ?? `The categorize request failed (HTTP ${httpStatus}).`, requested: unmatched });
        },
        (error: unknown) => {
          if (live) setAiCategorize({ status: "error", message: messageOf(error, "Couldn't reach the categorize route."), requested: unmatched });
        },
      );
    }, 0);
    return () => { live = false; clearTimeout(timer); };
  }, [unmatched]);
  const aiCategories = aiCategorize.status === "done" ? aiCategorize.categories : undefined;

  const purchases = useMemo(() => (data ? categorize(data.purchases, aiCategories) : []), [data, aiCategories]);
  const analysis = useMemo(
    () => (data ? analyzeCashBack({ purchases, selectedCardIds, asOfDate: data.asOfDate, windowDays }) : null),
    [data, purchases, selectedCardIds, windowDays],
  );

  // Facts and the templated summary rerun live with every change, like the rest of the page.
  const facts = useMemo(() => (analysis ? buildAdviceFacts(analysis, showSuggestion) : null), [analysis, showSuggestion]);
  const factsKey = useMemo(() => (facts ? JSON.stringify(facts) : ""), [facts]);
  const summary = useMemo(() => (facts ? templateNarration(facts) : null), [facts]);

  // AI advice runs on demand (it costs an API call) and is marked stale when the facts change.
  const [aiAdvice, setAiAdvice] = useState<AiAdviceState>({ status: "idle" });
  const requestAiAdvice = useCallback(async () => {
    if (!facts) return;
    const key = JSON.stringify(facts);
    setAiAdvice({ status: "loading" });
    try {
      const { httpStatus, data: body } = await postJson<AdviceResponse>("/api/cash-back/advice", facts);
      const response: AdviceResponse = body && "text" in body
        ? body
        : { status: "error", text: templateNarration(facts), message: (body as { message?: string } | null)?.message ?? `The advice request failed (HTTP ${httpStatus}).` };
      setAiAdvice({ status: "done", response, factsKey: key });
    } catch (error) {
      setAiAdvice({ status: "done", response: { status: "error", text: templateNarration(facts), message: messageOf(error, "Couldn't reach the advice route.") }, factsKey: key });
    }
  }, [facts]);
  const aiAdviceStale = aiAdvice.status === "done" && aiAdvice.factsKey !== factsKey;

  // Purchase lookup: cap room comes from what was actually spent on each card this period.
  const ledger = useMemo(() => (data ? actualCapLedger(purchases.filter(p => p.date <= data.asOfDate), findCard) : null), [data, purchases]);
  const [lookupQuery, setLookupQuery] = useState<LookupQuery | null>(null);
  const [lookupPending, setLookupPending] = useState(false);
  const selectedCards = useMemo(() => cardsByIds(selectedCardIds), [selectedCardIds]);
  const lookupResult = useMemo(
    () => (lookupQuery && ledger && data ? lookupPurchase(lookupQuery, selectedCards, ledger, data.asOfDate) : null),
    [lookupQuery, ledger, data, selectedCards],
  );

  const runLookup = useCallback(async (input: { merchant: string; category: Category | "auto"; amountCents: Cents }) => {
    const merchant = input.merchant.trim();
    if (input.category !== "auto") {
      setLookupQuery({ merchant, category: input.category, categorySource: "chosen", amountCents: input.amountCents });
      return;
    }
    const keyword = categorizeByKeyword(merchant);
    if (keyword) {
      setLookupQuery({ merchant, category: keyword, categorySource: "keyword", amountCents: input.amountCents });
      return;
    }
    setLookupPending(true);
    try {
      const { data: body } = await postJson<CategorizeResponse>("/api/cash-back/categorize", { merchants: [merchant] });
      const found = body?.status === "ok" && Object.hasOwn(body.categories, merchant) ? body.categories[merchant] : undefined;
      const category = isCategory(found) ? found : undefined;
      setLookupQuery(category
        ? { merchant, category, categorySource: "ai", amountCents: input.amountCents }
        : { merchant, category: "other", categorySource: "fallback", amountCents: input.amountCents });
    } catch {
      setLookupQuery({ merchant, category: "other", categorySource: "fallback", amountCents: input.amountCents });
    } finally {
      setLookupPending(false);
    }
  }, []);

  const actions = {
    setWindow(days: WindowDays) {
      prefsStore.set({ ...prefsStore.getSnapshot(), windowDays: days });
    },
    toggleCard(cardId: string) {
      prefsStore.set({ ...prefsStore.getSnapshot(), selectedCardIds: toggleCard(selectedCardIds, cardId) });
    },
    resetCards() {
      prefsStore.set({ ...prefsStore.getSnapshot(), selectedCardIds: null });
    },
    setShowSuggestion(show: boolean) {
      prefsStore.set({ ...prefsStore.getSnapshot(), showSuggestion: show });
    },
    requestAiAdvice,
    runLookup,
    clearLookup() {
      setLookupQuery(null);
    },
  };

  return {
    dataState,
    sourceLabel: dataSource.sourceLabel,
    isFixture: dataSource.isFixture,
    hydrated,
    data,
    selectedCardIds,
    selectionIsDefault: sameSelection(selectedCardIds, defaultCardIds),
    windowDays,
    showSuggestion,
    unmatched,
    aiCategorize,
    purchases,
    analysis,
    summary,
    aiAdvice,
    aiAdviceStale,
    lookupQuery,
    lookupResult,
    lookupPending,
    actions,
  };
}

export type CashBackModel = ReturnType<typeof useCashBack>;
