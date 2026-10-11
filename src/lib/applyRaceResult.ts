import { prisma } from "./prisma";
import { computeDriverScoringStats, DriverResultData } from "./scoring";
import { recomputeEnergyAndScoresFrom } from "./energyReplay";

export type ApplyRaceResultInput = {
  raceId: number;
  fastestLap: string;
  hasRedFlag: boolean;
  hasSprintRedFlag: boolean;
  driverResults: DriverResultData[];
};

/**
 * Enregistre les résultats OFFICIELS d'une course (RaceResult + DriverResult)
 * puis recalcule l'énergie et les scores de cette course et de toutes celles
 * qui suivent dans la saison. Réservé à la saisie admin (manuelle ou via le
 * bouton d'import Jolpica) — jamais appelé par le cron de scores provisoires,
 * qui lui ne fait qu'un aperçu sans écrire de résultat officiel.
 */
export async function applyRaceResult(input: ApplyRaceResultInput): Promise<{ racesRecomputed: number }> {
  const { raceId, fastestLap, hasRedFlag, hasSprintRedFlag, driverResults } = input;

  const race = await prisma.race.findUnique({ where: { id: raceId } });
  if (!race) {
    throw new Error("Course introuvable");
  }

  const raceResult = await prisma.raceResult.upsert({
    where: { raceId },
    update: { fastestLap, hasRedFlag, hasSprintRedFlag: hasSprintRedFlag ?? false },
    create: { raceId, fastestLap, hasRedFlag, hasSprintRedFlag: hasSprintRedFlag ?? false },
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

  // Le résultat est désormais officiel : l'aperçu provisoire (s'il existe) n'a
  // plus lieu d'être affiché.
  await prisma.provisionalScore.deleteMany({ where: { raceId } });

  // Recalcule l'énergie (journal d'événements rejoué en avant) et les scores de
  // cette course et de toutes celles qui suivent dans la saison. Nécessaire même
  // pour une première saisie : ça pose l'événement RACE de ce round et fait
  // toujours converger l'état vers la même logique, qu'il s'agisse d'une
  // création ou d'une correction d'une course déjà notée.
  return recomputeEnergyAndScoresFrom(race.season, race.round);
}
