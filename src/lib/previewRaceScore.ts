import { prisma } from "./prisma";
import { DRIVERS } from "./constants";
import { applyRaceToEnergy, EnergyMap, RaceOutcomeForEnergy } from "./energy";
import { calculateAllScoresWithBreakdown, DriverResultData, PickData } from "./scoring";

export type PreviewRaceResultInput = {
  raceId: number;
  fastestLap: string;
  hasRedFlag: boolean;
  hasSprintRedFlag: boolean;
  driverResults: DriverResultData[];
};

/**
 * Calcule ce que seraient les scores d'une course À PARTIR de résultats non
 * officiels (ex: import Jolpica automatique), SANS rien écrire : pas de
 * RaceResult, pas de DriverResult, pas de Score, pas de mutation d'énergie.
 * Sert uniquement à afficher un aperçu "provisoire". L'énergie pré-course
 * utilisée est l'énergie CONFIRMÉE actuelle (DriverEnergy), puisque cette
 * fonction n'a de sens que pour la prochaine course à noter (celle qui n'a
 * pas encore de RaceResult officiel).
 */
export async function previewRaceScores(
  input: PreviewRaceResultInput
): Promise<{ scores: Record<string, number>; breakdowns: Record<string, unknown> } | null> {
  const race = await prisma.race.findUnique({ where: { id: input.raceId } });
  if (!race) return null;

  const picks = await prisma.pick.findMany({ where: { raceId: input.raceId } });
  if (picks.length === 0) return { scores: {}, breakdowns: {} };

  const energyRecords = await prisma.driverEnergy.findMany({
    where: { userId: { in: picks.map((p) => p.userId) }, season: race.season },
  });
  const energyByUser: Record<string, EnergyMap> = {};
  for (const rec of energyRecords) {
    if (!energyByUser[rec.userId]) energyByUser[rec.userId] = {};
    energyByUser[rec.userId][rec.driverCode] = rec.energy;
  }

  const hasAnyFIA = picks.some((p) => p.strategy === "fia");
  const outcomes: RaceOutcomeForEnergy[] = input.driverResults.map((dr) => ({
    driverCode: dr.driverCode,
    isDnf: dr.isDnf,
    racePos: dr.racePos,
  }));

  const picksData: PickData[] = picks.map((pick) => {
    const pre: EnergyMap = {};
    for (const d of DRIVERS) pre[d.code] = energyByUser[pick.userId]?.[d.code] ?? 1.0;

    const { scoringEnergy } = applyRaceToEnergy(pick, pre, outcomes, hasAnyFIA);

    return {
      userId: pick.userId,
      driver1: pick.driver1,
      driver2: pick.driver2,
      driver1Energy: scoringEnergy[pick.driver1] ?? 1.0,
      driver2Energy: scoringEnergy[pick.driver2] ?? 1.0,
      team: pick.team,
      strategy: pick.strategy,
      drsTarget: pick.drsTarget,
      huileMoteurTarget: pick.huileMoteurTarget,
    };
  });

  const { scores, breakdowns } = calculateAllScoresWithBreakdown(
    picksData,
    {
      fastestLap: input.fastestLap,
      hasRedFlag: input.hasRedFlag,
      hasSprintRedFlag: input.hasSprintRedFlag,
      driverResults: input.driverResults,
    },
    race.hasSprint
  );

  return { scores, breakdowns };
}
