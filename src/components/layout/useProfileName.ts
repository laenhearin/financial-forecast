"use client";

import { useEffect, useState } from "react";

/** Keep both navigation labels aligned with the demo-profile cookie. */
export function useProfileName() {
  const [name, setName] = useState("Demo profile");
  useEffect(() => {
    let version = 0;
    const update = async () => {
      const requestVersion = ++version;
      try {
        const response = await fetch("/api/demo-profiles", { cache: "no-store" });
        if (!response.ok) throw new Error("Could not load profile");
        const data = await response.json() as { activeSlug: string; profiles: { slug: string; label: string }[] };
        if (requestVersion === version) setName(data.profiles.find(profile => profile.slug === data.activeSlug)?.label ?? "Demo profile");
      } catch {
        if (requestVersion === version) setName("Profile unavailable");
      }
    };
    void update();
    window.addEventListener("cloudcash-profile-change", update);
    window.addEventListener("storage", update);
    return () => {
      version++;
      window.removeEventListener("cloudcash-profile-change", update);
      window.removeEventListener("storage", update);
    };
  }, []);
  return name;
}
