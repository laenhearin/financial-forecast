import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { listNessieDemoProfiles } from "@/lib/nessie-demo";

export const dynamic = "force-dynamic";

const COOKIE_NAME = "cloudcash-demo-profile";

export async function GET() {
  const profiles = listNessieDemoProfiles();
  const requested = (await cookies()).get(COOKIE_NAME)?.value;
  const activeSlug = profiles.some((profile) => profile.slug === requested) ? requested! : "college";
  return NextResponse.json({ profiles, activeSlug }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  let body: { slug?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Choose a valid demo profile." }, { status: 400 });
  }
  const profiles = listNessieDemoProfiles();
  if (typeof body.slug !== "string" || !profiles.some((profile) => profile.slug === body.slug)) {
    return NextResponse.json({ message: "Choose a valid demo profile." }, { status: 400 });
  }
  const response = NextResponse.json({ activeSlug: body.slug });
  response.cookies.set(COOKIE_NAME, body.slug, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
