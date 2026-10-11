import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { DriverResultData } from "@/lib/scoring";
import { applyRaceResult } from "@/lib/applyRaceResult";

export async function POST(request: Request) {
  const session = await auth();
  const user = session?.user as { role?: string } | undefined;

  if (!session || (user?.role !== "ADMIN" && user?.role !== "CONTRIBUTOR")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = await request.json();
  const { raceId, fastestLap, hasRedFlag, hasSprintRedFlag, driverResults } = body as {
    raceId: number;
    fastestLap: string;
    hasRedFlag: boolean;
    hasSprintRedFlag: boolean;
    driverResults: DriverResultData[];
  };

  if (!raceId || !fastestLap || !Array.isArray(driverResults)) {
    return NextResponse.json({ error: "Champs manquants" }, { status: 400 });
  }

  try {
    const { racesRecomputed } = await applyRaceResult({
      raceId: Number(raceId),
      fastestLap,
      hasRedFlag,
      hasSprintRedFlag: hasSprintRedFlag ?? false,
      driverResults,
    });
    return NextResponse.json({ racesRecomputed });
  } catch {
    return NextResponse.json({ error: "Course introuvable" }, { status: 404 });
  }
}
