import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { listNessieDemoProfiles, loadNessieDemo } from "@/lib/nessie-demo";

const COOKIE_NAME = "cloudcash-demo-profile";

export async function getActiveDemoSlug() {
  const requested = (await cookies()).get(COOKIE_NAME)?.value;
  return listNessieDemoProfiles().some((profile) => profile.slug === requested) ? requested! : "college";
}

export const loadActiveDemo = cache(async function loadActiveDemo() {
  return loadNessieDemo(await getActiveDemoSlug());
});
