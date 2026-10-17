"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleUser, LogOut } from "lucide-react";
import { USER_NAME } from "@/lib/config";
import { ACTIVE_PROFILE_STORAGE_KEY } from "@/features/big-purchase/config";

type DemoProfile = { slug: string; label: string };

export default function ProfilePage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<DemoProfile[]>([]);
  const [selectedSlug, setSelectedSlug] = useState("college");
  const [notice, setNotice] = useState<string | null>(null);

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
      router.refresh();
      setNotice(`Switched to ${profiles.find((profile) => profile.slug === slug)?.label} demo profile.`);
    } catch {
      setNotice("The demo profile could not be changed. Please try again.");
    }
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
    </div>
  );
}
