"use client";

import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CircleUser, LogOut } from "lucide-react";
import { USER_NAME } from "@/lib/config";
import { centsToInputString, formatUSD, parseDollarsToCents } from "@/lib/money";
import { ACTIVE_PROFILE_STORAGE_KEY } from "@/features/big-purchase/config";
import { balanceSettingsStore } from "@/features/calendar/state/balanceSettingsStore";

type DemoProfile = { slug: string; label: string; criticalBalanceDefaultCents: number };

export default function ProfilePage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<DemoProfile[]>([]);
  const [selectedSlug, setSelectedSlug] = useState("college");
  const [notice, setNotice] = useState<string | null>(null);
  const [criticalBalanceInput, setCriticalBalanceInput] = useState("");
  const [criticalBalanceError, setCriticalBalanceError] = useState<string | null>(null);
  const savedCriticalBalance = useSyncExternalStore(balanceSettingsStore.subscribe, balanceSettingsStore.getSnapshot, balanceSettingsStore.getServerSnapshot);

  useEffect(() => {
    fetch("/api/demo-profiles")
      .then((response) => {
        if (!response.ok) throw new Error("Could not load demo profiles.");
        return response.json() as Promise<{ profiles: DemoProfile[]; activeSlug: string }>;
      })
      .then(({ profiles: available, activeSlug }) => {
        setProfiles(available);
        setSelectedSlug(activeSlug);
        window.localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, activeSlug);
        const active = available.find((profile) => profile.slug === activeSlug);
        setCriticalBalanceInput(centsToInputString(balanceSettingsStore.getSnapshot() ?? active?.criticalBalanceDefaultCents ?? 0));
      })
      .catch(() => setNotice("Demo profiles could not be loaded. Please try again later."));
  }, []);

  const selectedProfile = profiles.find((profile) => profile.slug === selectedSlug);
  const displayName = selectedProfile?.label ?? USER_NAME;

  async function changeProfile(slug: string) {
    setNotice(null);
    try {
      const response = await fetch("/api/demo-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      if (!response.ok) throw new Error("The demo profile could not be changed.");
      setSelectedSlug(slug);
      window.localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, slug);
      window.dispatchEvent(new Event("cloudcash-profile-change"));
      const nextProfile = profiles.find((profile) => profile.slug === slug);
      setCriticalBalanceInput(centsToInputString(balanceSettingsStore.getSnapshot() ?? nextProfile?.criticalBalanceDefaultCents ?? 0));
      setCriticalBalanceError(null);
      router.refresh();
      setNotice(`Switched to ${profiles.find((profile) => profile.slug === slug)?.label} demo profile.`);
    } catch {
      setNotice("The demo profile could not be changed. Please try again.");
    }
  }

  function saveCriticalBalance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cents = parseDollarsToCents(criticalBalanceInput);
    if (cents === null) {
      setCriticalBalanceError("Enter a valid amount of $0 or more, with up to two decimal places.");
      return;
    }
    balanceSettingsStore.setCriticalBalanceCents(cents);
    setCriticalBalanceError(null);
    setNotice("Critical balance setting saved for this demo profile.");
  }

  function resetCriticalBalance() {
    balanceSettingsStore.setCriticalBalanceCents(null);
    const defaultCents = selectedProfile?.criticalBalanceDefaultCents ?? 0;
    setCriticalBalanceInput(centsToInputString(defaultCents));
    setCriticalBalanceError(null);
    setNotice("Critical balance reset to the profile’s rent amount.");
  }

  return (
    <div className="mx-auto w-full max-w-180 px-5 py-12 md:px-10">
      <header className="mb-7">
        <h1 className="text-display font-medium text-primary">Profile</h1>
        <p className="mt-2 text-body text-secondary">Your CloudCash profile and app user options.</p>
      </header>

      <section aria-label="Profile details" className="rounded-panel border border-app bg-card p-5 md:p-6">
        <div className="flex items-center gap-3 border-b border-app pb-5">
          <span className="flex size-11 items-center justify-center rounded-full bg-accent-soft text-accent">
            <CircleUser aria-hidden className="size-6" strokeWidth={1.75} />
          </span>
          <div>
            <h2 className="text-lead font-semibold text-primary">{displayName}</h2>
            <p className="mt-0.5 text-caption text-secondary">CloudCash demo profile</p>
          </div>
        </div>

        <dl className="grid gap-4 py-5 sm:grid-cols-2">
          <div>
            <dt className="text-caption text-secondary">Name</dt>
            <dd className="mt-1 text-body font-medium text-primary">{displayName}</dd>
          </div>
          <div>
            <dt className="text-caption text-secondary">Age</dt>
            <dd className="mt-1 text-body font-medium text-primary">
              Not provided for demo profiles
            </dd>
          </div>
        </dl>

        <div className="flex flex-col gap-3 border-t border-app pt-5 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-1.5 text-caption font-medium text-secondary">
            Change app user
            <select
              value={selectedSlug}
              onChange={(event) => changeProfile(event.target.value)}
              className="ui-transition min-h-11 rounded-chip border border-app bg-card px-3 text-body text-primary outline-none focus:border-accent-line focus:ring-2 focus:ring-accent/20"
            >
              {profiles.map((profile) => (
                <option key={profile.slug} value={profile.slug}>{profile.label}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setNotice("This is a demo profile with no authenticated session, so there is nothing to sign out of yet.")}
            className="ui-transition inline-flex min-h-11 items-center justify-center gap-2 rounded-chip border border-app px-3 py-2 text-caption font-medium text-secondary hover:border-neg hover:bg-neg-soft hover:text-neg"
          >
            <LogOut aria-hidden className="size-4" />
            Sign out
          </button>
        </div>

        {notice && (
          <p role="status" className="mt-4 rounded-item bg-secondary px-3 py-2.5 text-caption text-secondary">
            {notice}
          </p>
        )}
        <p className="mt-4 text-micro text-secondary">
          These are synthetic demo profiles. Calendar, forecast, and rewards data update for the selected user.
        </p>
      </section>

      <section aria-labelledby="settings-title" className="mt-5 rounded-panel border border-app bg-card p-5 md:p-6">
        <h2 id="settings-title" className="text-lead font-semibold text-primary">Settings</h2>
        <p className="mt-1.5 text-caption text-secondary">Set the balance CloudCash treats as critical. By default, that is this profile’s monthly rent.</p>
        <form onSubmit={saveCriticalBalance} className="mt-5 max-w-xl">
          <label htmlFor="critical-balance" className="mb-1.5 block text-caption font-medium text-secondary">Critical balance ($)</label>
          <div className="flex flex-wrap gap-3">
            <input
              id="critical-balance"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={criticalBalanceInput}
              onChange={(event) => setCriticalBalanceInput(event.target.value)}
              className="ui-transition min-h-11 min-w-0 flex-1 rounded-chip border border-app bg-card px-3 text-body text-primary outline-none focus:border-accent-line focus:ring-2 focus:ring-accent/20"
            />
            <button type="submit" className="ui-transition min-h-11 rounded-chip bg-accent-soft px-4 text-caption font-semibold text-primary hover:bg-nav-active">Save threshold</button>
            <button type="button" onClick={resetCriticalBalance} className="ui-transition min-h-11 rounded-chip border border-app px-4 text-caption font-medium text-secondary hover:bg-nav-hover">Use rent amount</button>
          </div>
          {criticalBalanceError && <p role="alert" className="mt-2 text-caption text-neg">{criticalBalanceError}</p>}
          <p className="mt-3 text-micro text-secondary">
            Current threshold: {formatUSD(savedCriticalBalance ?? selectedProfile?.criticalBalanceDefaultCents ?? 0)}. At or below is critical; +$200 is above critical, +$700 is okay, and +$1,200 is great.
          </p>
        </form>
      </section>
    </div>
  );
}
