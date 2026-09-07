import { prisma } from "../src/lib/prisma";
import { DRIVERS } from "../src/lib/constants";
import { recomputeEnergyAndScoresFrom } from "../src/lib/energyReplay";

const SEASON = 2026;
const MANUAL_ROUND = 11; // GP de Hongrie — ajustement appliqué après ce round
const MANUAL_DELTA = 0.1;
const MANUAL_DATE = new Date("2026-07-26T12:00:00.000Z");

async function main() {
  const before = {
    scores: await prisma.score.findMany({ where: { race: { season: SEASON } } }),
    energies: await prisma.driverEnergy.findMany({ where: { season: SEASON } }),
  };

  const users = await prisma.user.findMany({ select: { id: true, name: true } });

  // Seed l'ajustement manuel du 26/07 (aucune autre trace de ce delta en base).
  await prisma.energyEvent.deleteMany({
    where: { season: SEASON, source: "MANUAL", round: MANUAL_ROUND, createdAt: MANUAL_DATE },
  });
  await prisma.energyEvent.createMany({
    data: users.flatMap((u) =>
      DRIVERS.map((d) => ({
        userId: u.id,
        driverCode: d.code,
        season: SEASON,
        round: MANUAL_ROUND,
        source: "MANUAL",
        raceId: null,
        delta: MANUAL_DELTA,
        energyAfter: 1.0, // placeholder, recalculé par le replay ci-dessous
        createdAt: MANUAL_DATE,
      }))
    ),
  });

  const { racesRecomputed } = await recomputeEnergyAndScoresFrom(SEASON, 1);
  console.log(`Replay terminé : ${racesRecomputed} courses recalculées.`);

  const after = {
    scores: await prisma.score.findMany({ where: { race: { season: SEASON } }, include: { race: true, user: true } }),
    energies: await prisma.driverEnergy.findMany({ where: { season: SEASON }, include: { user: true } }),
  };

  const beforeScoreByKey = new Map(before.scores.map((s) => [`${s.userId}:${s.raceId}`, s.points]));
  console.log("\n--- Diff des scores (avant -> après) ---");
  for (const s of after.scores) {
    const prev = beforeScoreByKey.get(`${s.userId}:${s.raceId}`);
    if (prev !== s.points) {
      console.log(`${s.user.name} / R${s.race.round} ${s.race.name}: ${prev ?? "∅"} -> ${s.points}`);
    }
  }

  const beforeEnergyByKey = new Map(
    before.energies.map((e) => [`${e.userId}:${e.driverCode}`, e.energy])
  );
  console.log("\n--- Diff énergie courante (avant -> après), écarts > 0.001 ---");
  for (const e of after.energies) {
    const prev = beforeEnergyByKey.get(`${e.userId}:${e.driverCode}`);
    if (prev === undefined || Math.abs(prev - e.energy) > 0.001) {
      console.log(
        `${e.user.name} / ${e.driverCode}: ${prev !== undefined ? (prev * 100).toFixed(0) + "%" : "∅"} -> ${(e.energy * 100).toFixed(0)}%`
      );
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
