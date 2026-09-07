import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeDriverScoringStats, DriverResultData } from "@/lib/scoring";
import { recomputeEnergyAndScoresFrom } from "@/lib/energyReplay";

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

  const race = await prisma.race.findUnique({ where: { id: Number(raceId) } });
  if (!race) {
    return NextResponse.json({ error: "Course introuvable" }, { status: 404 });
  }

  // ---------------------------------------------------------------------------
  // Créer ou mettre à jour le RaceResult + DriverResults
  // ---------------------------------------------------------------------------
  const raceResult = await prisma.raceResult.upsert({
    where: { raceId: Number(raceId) },
    update: { fastestLap, hasRedFlag, hasSprintRedFlag: hasSprintRedFlag ?? false },
    create: { raceId: Number(raceId), fastestLap, hasRedFlag, hasSprintRedFlag: hasSprintRedFlag ?? false },
  });

  // Position du dernier finisher (hors DNF) pour le malus queue de peloton
  const finisherPositions = driverResults
    .filter((r) => !r.isDnf && r.racePos !== null)
    .map((r) => r.racePos as number);
  const lastFinishPos = finisherPositions.length > 0 ? Math.max(...finisherPositions) : 0;

  for (const dr of driverResults) {
    const scoring = computeDriverScoringStats(dr, fastestLap, lastFinishPos);
    const baseFields = {
      qualifyingPos: dr.qualifyingPos,
      racePos: dr.racePos,
      isDnf: dr.isDnf,
      sprintQualiPos: dr.sprintQualiPos ?? null,
      sprintRacePos: dr.sprintRacePos ?? null,
      sprintIsDnf: dr.sprintIsDnf ?? false,
      ...scoring,
    };
    await prisma.driverResult.upsert({
      where: { raceResultId_driverCode: { raceResultId: raceResult.id, driverCode: dr.driverCode } },
      update: baseFields,
      create: { raceResultId: raceResult.id, driverCode: dr.driverCode, ...baseFields },
    });
  }

  // ---------------------------------------------------------------------------
  // Recalcule l'énergie (journal d'événements rejoué en avant) et les scores de
  // cette course et de toutes celles qui suivent dans la saison. Nécessaire même
  // pour une première saisie : ça pose l'événement RACE de ce round et fait
  // toujours converger l'état vers la même logique, qu'il s'agisse d'une
  // création ou d'une correction d'une course déjà notée.
  // ---------------------------------------------------------------------------
  const { racesRecomputed } = await recomputeEnergyAndScoresFrom(race.season, race.round);

  return NextResponse.json({ racesRecomputed });
}
