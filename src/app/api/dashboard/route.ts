import { getNessieStatus } from "@/lib/nessie";
export const dynamic = "force-dynamic";
export async function GET() {
  return Response.json({ mode: "demo", nessie: getNessieStatus() }, { headers: { "Cache-Control": "no-store" } });
}
