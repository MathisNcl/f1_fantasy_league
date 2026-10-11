import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { fetchJolpicaResults } from "@/lib/jolpica";

export async function GET(request: Request) {
  const session = await auth();
  const user = session?.user as { role?: string } | undefined;

  if (!session || (user?.role !== "ADMIN" && user?.role !== "CONTRIBUTOR")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const round = searchParams.get("round");
  const season = searchParams.get("season");
  const hasSprint = searchParams.get("hasSprint") === "true";

  if (!round || !season) {
    return NextResponse.json({ error: "round et season requis" }, { status: 400 });
  }

  const result = await fetchJolpicaResults(Number(season), Number(round), hasSprint);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return NextResponse.json({ rows: result.rows, fastestLap: result.fastestLap, mapped: result.mapped });
}
