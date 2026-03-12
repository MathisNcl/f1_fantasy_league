import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateAllScoresWithBreakdown, computeDriverScoringStats, DriverResultData } from "@/lib/scoring";
import { DRIVERS } from "@/lib/constants";

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

  const allDriverCodes = DRIVERS.map((d) => d.code);

  // ---------------------------------------------------------------------------
  // Charger les anciens résultats AVANT de les écraser (pour inverser les énergies)
  // ---------------------------------------------------------------------------
  const existingRaceResult = await prisma.raceResult.findUnique({
    where: { raceId: Number(raceId) },
    include: {
      driverResults: { select: { driverCode: true, isDnf: true, racePos: true } },
    },
  });
  const oldDriverResults = existingRaceResult?.driverResults ?? [];

  // ---------------------------------------------------------------------------
  // Charger les picks et les énergies actuelles
  // ---------------------------------------------------------------------------
  const picks = await prisma.pick.findMany({
    where: { raceId: Number(raceId) },
  });

  const energyRecords = await prisma.driverEnergy.findMany({
    where: {
      userId: { in: picks.map((p) => p.userId) },
      season: race.season,
    },
  });

  // Map : userId → driverCode → energy
  const energyByUser: Record<string, Record<string, number>> = {};
  for (const rec of energyRecords) {
    if (!energyByUser[rec.userId]) energyByUser[rec.userId] = {};
    energyByUser[rec.userId][rec.driverCode] = rec.energy;
  }

  // ---------------------------------------------------------------------------
  // Si re-soumission : inverser les changements d'énergie de l'ancienne course
  // pour retrouver l'état pré-course avant d'appliquer les nouveaux
  // ---------------------------------------------------------------------------
  if (existingRaceResult && oldDriverResults.length > 0) {
    for (const pick of picks) {
      if (!energyByUser[pick.userId]) energyByUser[pick.userId] = {};
      const userEnergy = energyByUser[pick.userId];

      // Ancien perdant (anciens résultats)
      const oldDr1 = oldDriverResults.find((r) => r.driverCode === pick.driver1);
      const oldDr2 = oldDriverResults.find((r) => r.driverCode === pick.driver2);
      const oldPos1 =
        !oldDr1 || oldDr1.isDnf || oldDr1.racePos === null ? Infinity : oldDr1.racePos;
      const oldPos2 =
        !oldDr2 || oldDr2.isDnf || oldDr2.racePos === null ? Infinity : oldDr2.racePos;
      const oldLoserCode =
        oldPos1 === oldPos2 ? null : oldPos1 > oldPos2 ? pick.driver1 : pick.driver2;

      const teamDriverCodes = new Set(
        DRIVERS.filter((d) => d.team === pick.team).map((d) => d.code)
      );

      for (const code of allDriverCodes) {
        let energy = userEnergy[code] ?? 1.0;

        const wasSelected = code === pick.driver1 || code === pick.driver2;
        const wasTeamDriver = teamDriverCodes.has(code);

        // Inverser dans l'ordre inverse de l'application originale :
        // 5. Inverse team : -0.05 → +0.05
        if (wasTeamDriver) energy += 0.05;
        // 4. Inverse non-sélectionné non-team : +0.05 → -0.05
        if (!wasSelected && !wasTeamDriver) energy -= 0.05;
        // 3. Inverse perdant : -0.05 → +0.05
        if (wasSelected && pick.strategy !== "moteur" && code === oldLoserCode) energy += 0.05;
        // 2. Inverse sélectionné : -0.20 → +0.20
        if (wasSelected && pick.strategy !== "moteur") energy += 0.2;
        // 1. Inverse huile_moteur : +0.10 → -0.10
        if (pick.strategy === "huile_moteur" && pick.huileMoteurTarget === code) energy -= 0.1;

        energyByUser[pick.userId][code] = Math.max(0, Math.min(1.0, energy));
      }
    }
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
  // Construire les PickData avec les énergies pré-course (après inversion éventuelle)
  // ---------------------------------------------------------------------------
  const picksData = picks.map((p) => {
    const userEnergy = energyByUser[p.userId] ?? {};
    let d1Energy = userEnergy[p.driver1] ?? 1.0;
    let d2Energy = userEnergy[p.driver2] ?? 1.0;

    // Appliquer le boost Huile moteur avant la course
    if (p.strategy === "huile_moteur" && p.huileMoteurTarget) {
      if (p.huileMoteurTarget === p.driver1) d1Energy = Math.min(1.0, d1Energy + 0.1);
      if (p.huileMoteurTarget === p.driver2) d2Energy = Math.min(1.0, d2Energy + 0.1);
    }

    return {
      userId: p.userId,
      driver1: p.driver1,
      driver2: p.driver2,
      driver1Energy: d1Energy,
      driver2Energy: d2Energy,
      team: p.team,
      strategy: p.strategy,
      drsTarget: p.drsTarget,
      huileMoteurTarget: p.huileMoteurTarget,
    };
  });

  // Calculer les scores + décompositions
  const { scores, breakdowns } = calculateAllScoresWithBreakdown(
    picksData,
    { fastestLap, hasRedFlag, hasSprintRedFlag: hasSprintRedFlag ?? false, driverResults },
    race.hasSprint
  );

  // Sauvegarder les scores avec leur décomposition
  const scorePromises = Object.entries(scores).map(([userId, points]) =>
    prisma.score.upsert({
      where: { userId_raceId: { userId, raceId: Number(raceId) } },
      update: { points, breakdown: JSON.stringify(breakdowns[userId]) },
      create: { userId, raceId: Number(raceId), points, breakdown: JSON.stringify(breakdowns[userId]) },
    })
  );
  await Promise.all(scorePromises);

  // ---------------------------------------------------------------------------
  // Mettre à jour les énergies après la course (depuis l'état pré-course)
  // ---------------------------------------------------------------------------
  for (const pick of picks) {
    const userEnergy = energyByUser[pick.userId] ?? {};

    // Déterminer le perdant (course principale uniquement)
    const dr1Result = driverResults.find((r) => r.driverCode === pick.driver1);
    const dr2Result = driverResults.find((r) => r.driverCode === pick.driver2);
    const pos1 =
      !dr1Result || dr1Result.isDnf || dr1Result.racePos === null
        ? Infinity
        : dr1Result.racePos;
    const pos2 =
      !dr2Result || dr2Result.isDnf || dr2Result.racePos === null
        ? Infinity
        : dr2Result.racePos;
    const loserCode =
      pos1 === pos2 ? null : pos1 > pos2 ? pick.driver1 : pick.driver2;

    const teamDriverCodes = new Set(
      DRIVERS.filter((d) => d.team === pick.team).map((d) => d.code)
    );

    const energyUpdates: Array<{ driverCode: string; energy: number }> = [];

    for (const code of allDriverCodes) {
      let energy = userEnergy[code] ?? 1.0;

      // Appliquer le boost Huile moteur sur l'énergie stockée
      if (pick.strategy === "huile_moteur" && pick.huileMoteurTarget === code) {
        energy = Math.min(1.0, energy + 0.1);
      }

      const isSelected = code === pick.driver1 || code === pick.driver2;
      const isTeamDriver = teamDriverCodes.has(code);

      if (isSelected) {
        if (pick.strategy !== "moteur") {
          energy -= 0.2; // -20% sélectionné
          if (code === loserCode) energy -= 0.05; // -5% perdant
        }
      } else if (!isTeamDriver) {
        energy = Math.min(1.0, energy + 0.05);
      }

      if (isTeamDriver) {
        energy -= 0.05;
      }

      energy = Math.max(0, Math.min(1.0, energy));
      energyUpdates.push({ driverCode: code, energy });
    }

    // Sauvegarder en DB
    await Promise.all(
      energyUpdates.map(({ driverCode, energy }) =>
        prisma.driverEnergy.upsert({
          where: {
            userId_driverCode_season: {
              userId: pick.userId,
              driverCode,
              season: race.season,
            },
          },
          update: { energy },
          create: { userId: pick.userId, driverCode, energy, season: race.season },
        })
      )
    );
  }

  return NextResponse.json({ scoresCalculated: Object.keys(scores).length });
}
