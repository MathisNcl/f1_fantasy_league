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

  // Créer ou mettre à jour le RaceResult
  const raceResult = await prisma.raceResult.upsert({
    where: { raceId: Number(raceId) },
    update: { fastestLap, hasRedFlag, hasSprintRedFlag: hasSprintRedFlag ?? false },
    create: { raceId: Number(raceId), fastestLap, hasRedFlag, hasSprintRedFlag: hasSprintRedFlag ?? false },
  });

  // Mettre à jour les DriverResult (upsert par driverCode)
  for (const dr of driverResults) {
    const scoring = computeDriverScoringStats(dr, fastestLap);
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

  // Récupérer tous les picks pour cette course
  const picks = await prisma.pick.findMany({
    where: { raceId: Number(raceId) },
  });

  // Charger les énergies actuelles pour tous les joueurs de cette course
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

  // Construire les PickData avec les énergies effectives
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
  // Mettre à jour les énergies après la course
  // ---------------------------------------------------------------------------
  const allDriverCodes = DRIVERS.map((d) => d.code);

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
    // Si les deux sont Infinity (tous deux DNF), pas de perdant
    const loserCode =
      pos1 === pos2
        ? null
        : pos1 > pos2
        ? pick.driver1
        : pick.driver2;

    // Pilotes de l'écurie choisie
    const teamDriverCodes = new Set(
      DRIVERS.filter((d) => d.team === pick.team).map((d) => d.code)
    );

    // Calculer les nouvelles énergies pour tous les pilotes
    const energyUpdates: Array<{ driverCode: string; energy: number }> = [];

    for (const code of allDriverCodes) {
      let energy = userEnergy[code] ?? 1.0;

      // Appliquer le boost Huile moteur sur l'énergie stockée avant les changements post-course
      if (pick.strategy === "huile_moteur" && pick.huileMoteurTarget === code) {
        energy = Math.min(1.0, energy + 0.1);
      }

      const isSelected = code === pick.driver1 || code === pick.driver2;
      const isTeamDriver = teamDriverCodes.has(code);

      if (isSelected) {
        // Pas de fatigue avec "moteur"
        if (pick.strategy !== "moteur") {
          energy -= 0.2; // -20% sélectionné
          if (code === loserCode) energy -= 0.05; // -5% perdant
        }
      } else if (!isTeamDriver) {
        // Non sélectionné et pas pilote de l'écurie : +5% de récupération
        energy = Math.min(1.0, energy + 0.05);
      }

      // Pilote de l'écurie choisie : -5% (applicable à tous, sélectionnés ou non)
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
