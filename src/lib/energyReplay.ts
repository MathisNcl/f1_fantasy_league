import { prisma } from "./prisma";
import { DRIVERS } from "./constants";
import { applyRaceToEnergy, EnergyMap, RaceOutcomeForEnergy } from "./energy";
import { calculateAllScoresWithBreakdown, DriverResultData, PickData } from "./scoring";

// Clé de tri : les événements RACE d'un round passent avant les événements
// MANUAL du même round (un ajustement manuel est toujours postérieur à la
// dernière course jouée au moment où il a été déclenché).
function sortKey(round: number, source: "RACE" | "MANUAL"): number {
  return round * 2 + (source === "MANUAL" ? 1 : 0);
}

type RaceStep = {
  type: "race";
  round: number;
  raceId: number;
  hasSprint: boolean;
  fastestLap: string;
  hasRedFlag: boolean;
  hasSprintRedFlag: boolean;
  driverResults: DriverResultData[];
  picks: {
    userId: string;
    driver1: string;
    driver2: string;
    team: string;
    strategy: string;
    drsTarget: string | null;
    huileMoteurTarget: string | null;
  }[];
  createdAt: Date;
};

type ManualStep = {
  type: "manual";
  round: number;
  userId: string;
  driverCode: string;
  delta: number;
  createdAt: Date;
};

/**
 * Recalcule l'énergie (via le journal EnergyEvent) et les scores de toutes les
 * courses de la saison à partir de `fromRound` (inclus) jusqu'à la dernière
 * course jouée. À utiliser après toute modification des résultats d'une course
 * déjà notée, pour propager l'effet correctement dans le temps au lieu
 * d'inverser un delta sur une énergie potentiellement clampée.
 */
export async function recomputeEnergyAndScoresFrom(
  season: number,
  fromRound: number
): Promise<{ racesRecomputed: number }> {
  const [priorEventsRaw, staleManualEvents, races] = await Promise.all([
    prisma.energyEvent.findMany({
      where: { season, round: { lt: fromRound } },
      orderBy: [{ round: "asc" }, { createdAt: "asc" }],
    }),
    prisma.energyEvent.findMany({
      where: { season, round: { gte: fromRound }, source: "MANUAL" },
    }),
    prisma.race.findMany({
      where: { season, round: { gte: fromRound }, result: { isNot: null } },
      orderBy: { round: "asc" },
      include: {
        result: { include: { driverResults: true } },
        picks: true,
      },
    }),
  ]);

  // État d'énergie connu juste avant fromRound (dernier événement par pilote/utilisateur).
  const baseline: Record<string, EnergyMap> = {};
  for (const ev of priorEventsRaw) {
    if (!baseline[ev.userId]) baseline[ev.userId] = {};
    baseline[ev.userId][ev.driverCode] = ev.energyAfter;
  }

  const energyByUser: Record<string, EnergyMap> = {};
  function getEnergy(userId: string): EnergyMap {
    if (!energyByUser[userId]) {
      const map: EnergyMap = {};
      for (const d of DRIVERS) map[d.code] = baseline[userId]?.[d.code] ?? 1.0;
      energyByUser[userId] = map;
    }
    return energyByUser[userId];
  }

  const raceSteps: RaceStep[] = races
    .filter((r) => r.result !== null)
    .map((r) => ({
      type: "race",
      round: r.round,
      raceId: r.id,
      hasSprint: r.hasSprint,
      fastestLap: r.result!.fastestLap,
      hasRedFlag: r.result!.hasRedFlag,
      hasSprintRedFlag: r.result!.hasSprintRedFlag,
      driverResults: r.result!.driverResults.map((dr) => ({
        driverCode: dr.driverCode,
        qualifyingPos: dr.qualifyingPos,
        racePos: dr.racePos,
        isDnf: dr.isDnf,
        sprintQualiPos: dr.sprintQualiPos,
        sprintRacePos: dr.sprintRacePos,
        sprintIsDnf: dr.sprintIsDnf,
      })),
      picks: r.picks.map((p) => ({
        userId: p.userId,
        driver1: p.driver1,
        driver2: p.driver2,
        team: p.team,
        strategy: p.strategy,
        drsTarget: p.drsTarget,
        huileMoteurTarget: p.huileMoteurTarget,
      })),
      createdAt: r.date,
    }));

  const manualSteps: ManualStep[] = staleManualEvents.map((ev) => ({
    type: "manual",
    round: ev.round,
    userId: ev.userId,
    driverCode: ev.driverCode,
    delta: ev.delta ?? 0,
    createdAt: ev.createdAt,
  }));

  const orderedSteps = [...raceSteps, ...manualSteps].sort((a, b) => {
    const ka = sortKey(a.round, a.type === "race" ? "RACE" : "MANUAL");
    const kb = sortKey(b.round, b.type === "race" ? "RACE" : "MANUAL");
    if (ka !== kb) return ka - kb;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  const newEventRows: {
    userId: string;
    driverCode: string;
    season: number;
    round: number;
    source: string;
    raceId: number | null;
    delta: number | null;
    energyAfter: number;
    createdAt: Date;
  }[] = [];

  const scoreUpserts: { userId: string; raceId: number; points: number; breakdown: string }[] = [];

  for (const step of orderedSteps) {
    if (step.type === "race") {
      const hasAnyFIA = step.picks.some((p) => p.strategy === "fia");
      const outcomes: RaceOutcomeForEnergy[] = step.driverResults.map((dr) => ({
        driverCode: dr.driverCode,
        isDnf: dr.isDnf,
        racePos: dr.racePos,
      }));

      const picksData: PickData[] = [];

      for (const pick of step.picks) {
        const pre = getEnergy(pick.userId);
        const { scoringEnergy, postEnergy } = applyRaceToEnergy(pick, pre, outcomes, hasAnyFIA);

        picksData.push({
          userId: pick.userId,
          driver1: pick.driver1,
          driver2: pick.driver2,
          driver1Energy: scoringEnergy[pick.driver1] ?? 1.0,
          driver2Energy: scoringEnergy[pick.driver2] ?? 1.0,
          team: pick.team,
          strategy: pick.strategy,
          drsTarget: pick.drsTarget,
          huileMoteurTarget: pick.huileMoteurTarget,
        });

        energyByUser[pick.userId] = postEnergy;
        for (const d of DRIVERS) {
          newEventRows.push({
            userId: pick.userId,
            driverCode: d.code,
            season,
            round: step.round,
            source: "RACE",
            raceId: step.raceId,
            delta: null,
            energyAfter: postEnergy[d.code],
            createdAt: step.createdAt,
          });
        }
      }

      if (picksData.length > 0) {
        const { scores, breakdowns } = calculateAllScoresWithBreakdown(
          picksData,
          {
            fastestLap: step.fastestLap,
            hasRedFlag: step.hasRedFlag,
            hasSprintRedFlag: step.hasSprintRedFlag,
            driverResults: step.driverResults,
          },
          step.hasSprint
        );
        for (const [userId, points] of Object.entries(scores)) {
          scoreUpserts.push({
            userId,
            raceId: step.raceId,
            points,
            breakdown: JSON.stringify(breakdowns[userId]),
          });
        }
      }
    } else {
      const map = getEnergy(step.userId);
      const pre = map[step.driverCode] ?? 1.0;
      const after = Math.max(0, Math.min(1, pre + step.delta));
      map[step.driverCode] = after;
      newEventRows.push({
        userId: step.userId,
        driverCode: step.driverCode,
        season,
        round: step.round,
        source: "MANUAL",
        raceId: null,
        delta: step.delta,
        energyAfter: after,
        createdAt: step.createdAt,
      });
    }
  }

  // Persistance (atomique) : on remplace intégralement les événements >=
  // fromRound, on réécrit les scores impactés, puis on synchronise la vue
  // "courante" DriverEnergy.
  await prisma.$transaction([
    prisma.energyEvent.deleteMany({ where: { season, round: { gte: fromRound } } }),
    ...(newEventRows.length > 0 ? [prisma.energyEvent.createMany({ data: newEventRows })] : []),
    ...scoreUpserts.map((s) =>
      prisma.score.upsert({
        where: { userId_raceId: { userId: s.userId, raceId: s.raceId } },
        update: { points: s.points, breakdown: s.breakdown },
        create: { userId: s.userId, raceId: s.raceId, points: s.points, breakdown: s.breakdown },
      })
    ),
    ...Object.entries(energyByUser).flatMap(([userId, map]) =>
      Object.entries(map).map(([driverCode, energy]) =>
        prisma.driverEnergy.upsert({
          where: { userId_driverCode_season: { userId, driverCode, season } },
          update: { energy },
          create: { userId, driverCode, energy, season },
        })
      )
    ),
  ]);

  return { racesRecomputed: raceSteps.length };
}

/**
 * Enregistre un ajustement manuel global (+X% / -X% pour tous les pilotes de
 * tous les utilisateurs) comme un événement daté, à la suite de la dernière
 * course jouée. Contrairement à l'ancien comportement, le delta brut est
 * conservé pour pouvoir être rejoué si une course antérieure est éditée plus tard.
 */
export async function applyManualEnergyAdjustment(
  season: number,
  delta: number
): Promise<{ updated: number }> {
  const [users, lastPlayedRace, existing] = await Promise.all([
    prisma.user.findMany({ select: { id: true } }),
    prisma.race.findFirst({
      where: { season, result: { isNot: null } },
      orderBy: { round: "desc" },
      select: { round: true },
    }),
    prisma.driverEnergy.findMany({ where: { season } }),
  ]);

  const round = lastPlayedRace?.round ?? 0;
  const existingByKey = new Map(existing.map((e) => [`${e.userId}:${e.driverCode}`, e.energy]));

  const now = new Date();
  const eventRows = [];
  const driverEnergyUpserts = [];

  for (const user of users) {
    for (const driver of DRIVERS) {
      const current = existingByKey.get(`${user.id}:${driver.code}`) ?? 1.0;
      const after = Math.max(0, Math.min(1, current + delta));

      eventRows.push({
        userId: user.id,
        driverCode: driver.code,
        season,
        round,
        source: "MANUAL",
        raceId: null,
        delta,
        energyAfter: after,
        createdAt: now,
      });

      driverEnergyUpserts.push(
        prisma.driverEnergy.upsert({
          where: { userId_driverCode_season: { userId: user.id, driverCode: driver.code, season } },
          update: { energy: after },
          create: { userId: user.id, driverCode: driver.code, energy: after, season },
        })
      );
    }
  }

  await prisma.$transaction([
    prisma.energyEvent.createMany({ data: eventRows }),
    ...driverEnergyUpserts,
  ]);

  return { updated: eventRows.length };
}
