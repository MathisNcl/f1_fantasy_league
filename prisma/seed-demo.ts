/**
 * Seed de démonstration — crée 5 joueurs fictifs avec picks et scores
 * pour visualiser le classement, l'historique et le détail des points.
 *
 * Usage : npm run db:seed-demo
 * Idempotent : supprime les données demo existantes avant de les recréer.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  calculateAllScoresWithBreakdown,
  computeDriverScoringStats,
  type PickData,
  type DriverResultData,
} from "../src/lib/scoring";

const prisma = new PrismaClient();

// ─── Données pilotes / écuries (mirror de constants.ts) ─────────────────────

const DRIVER_CODES = [
  "VER", "HAD", "NOR", "PIA", "LEC", "HAM", "RUS", "ANT",
  "ALO", "STR", "GAS", "COL", "ALB", "SAI", "LIN", "LAW",
  "HUL", "BOR", "OCO", "BEA", "PER", "BOT",
];

const TEAMS = [
  "Red Bull", "McLaren", "Ferrari", "Mercedes", "Aston Martin",
  "Alpine", "Williams", "RB", "Audi", "Haas", "Cadillac",
];

// Tokens max par stratégie (mirror de constants.ts)
// drs, undercut, fia, huile_moteur exclus du demo (effets inter-joueurs complexes)
const STRATEGY_TOKENS: Record<string, number> = {
  ultra_tendre: 2, soft: 2, medium: 5, hard: 2, super_dur: 2,
  pluie: 2, moteur: 1,
};

// ─── Utilitaires ─────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Génération d'un résultat de course aléatoire ────────────────────────────

type FakeRaceResult = {
  qualiOrder: string[];
  finishOrder: string[];
  dnfs: string[];
  fastestLap: string;
  hasRedFlag: boolean;
  sprintQualiOrder: string[];
  sprintFinishOrder: string[];
  sprintDnfs: string[];
  hasSprintRedFlag: boolean;
};

function generateRaceResult(hasSprint: boolean): FakeRaceResult {
  const qualiOrder   = shuffle(DRIVER_CODES);
  const allRaceOrder = shuffle(DRIVER_CODES);
  const dnfCount     = Math.floor(Math.random() * 4);
  const dnfs         = allRaceOrder.slice(allRaceOrder.length - dnfCount);
  const dnfSet       = new Set(dnfs);
  const finishOrder  = allRaceOrder.filter((c) => !dnfSet.has(c));
  const fastestLap   = finishOrder[Math.floor(Math.random() * Math.min(10, finishOrder.length))];
  const hasRedFlag   = Math.random() < 0.15;

  let sprintQualiOrder: string[]  = [];
  let sprintFinishOrder: string[] = [];
  let sprintDnfs: string[]        = [];
  let hasSprintRedFlag             = false;

  if (hasSprint) {
    sprintQualiOrder = shuffle(DRIVER_CODES);
    const allSprintOrder = shuffle(DRIVER_CODES);
    const sDnfCount  = Math.floor(Math.random() * 2);
    sprintDnfs       = allSprintOrder.slice(allSprintOrder.length - sDnfCount);
    const sDnfSet    = new Set(sprintDnfs);
    sprintFinishOrder = allSprintOrder.filter((c) => !sDnfSet.has(c));
    hasSprintRedFlag  = Math.random() < 0.15;
  }

  return {
    qualiOrder, finishOrder, dnfs, fastestLap, hasRedFlag,
    sprintQualiOrder, sprintFinishOrder, sprintDnfs, hasSprintRedFlag,
  };
}

// Convertit un FakeRaceResult en DriverResultData[] pour le moteur de scoring
function toDriverResults(rr: FakeRaceResult, hasSprint: boolean): DriverResultData[] {
  return DRIVER_CODES.map((code) => {
    const qualifyingPos = rr.qualiOrder.indexOf(code) + 1;
    const isDnf         = rr.dnfs.includes(code);
    const racePos       = isDnf ? null : rr.finishOrder.indexOf(code) + 1;

    const sprintIsDnf  = hasSprint && rr.sprintDnfs.includes(code);
    const sprintRacePos = hasSprint && !sprintIsDnf
      ? rr.sprintFinishOrder.indexOf(code) + 1
      : null;
    const sprintQualiPos = hasSprint
      ? rr.sprintQualiOrder.indexOf(code) + 1
      : null;

    return {
      driverCode: code,
      qualifyingPos,
      racePos,
      isDnf,
      sprintQualiPos,
      sprintRacePos,
      sprintIsDnf,
    };
  });
}

// ─── Joueurs demo ─────────────────────────────────────────────────────────────

const DEMO_USERS = [
  { name: "Théo",  email: "theo@demo.f1fantasy.local"  },
  { name: "Julie", email: "julie@demo.f1fantasy.local" },
  { name: "Marco", email: "marco@demo.f1fantasy.local" },
  { name: "Sarah", email: "sarah@demo.f1fantasy.local" },
  { name: "Rayan", email: "rayan@demo.f1fantasy.local" },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════╗");
  console.log("║     Seed de démonstration F1 Fantasy  ║");
  console.log("╚══════════════════════════════════════╝\n");

  // 1. Nettoyage des données demo existantes
  const demoEmails = DEMO_USERS.map((u) => u.email);
  const existingDemoUsers = await prisma.user.findMany({
    where: { email: { in: demoEmails } },
  });
  if (existingDemoUsers.length > 0) {
    const ids = existingDemoUsers.map((u) => u.id);
    await prisma.score.deleteMany({ where: { userId: { in: ids } } });
    await prisma.pick.deleteMany({ where: { userId: { in: ids } } });
    await prisma.driverEnergy.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    console.log(`🗑  ${existingDemoUsers.length} joueurs demo supprimés (reset)\n`);
  }

  // 2. Création des joueurs demo
  const demoPassword = await bcrypt.hash("demo123", 10);
  const users: { id: string; name: string }[] = [];
  for (const u of DEMO_USERS) {
    const user = await prisma.user.create({
      data: { name: u.name, email: u.email, password: demoPassword, role: "USER" },
    });
    users.push(user);
    console.log(`✅ Joueur créé : ${u.name} (${u.email})`);
  }
  console.log();

  // 3. Récupération des 5 premières courses 2026
  const races = await prisma.race.findMany({
    where: { season: 2026 },
    orderBy: { round: "asc" },
    take: 5,
  });

  if (races.length === 0) {
    console.error("❌ Aucune course trouvée — exécutez d'abord npm run db:seed");
    return;
  }
  console.log(`📅 ${races.length} courses utilisées :\n`);

  // Suivi des tokens stratégie par joueur
  const strategyUsed: Record<string, Record<string, number>> = {};
  for (const u of users) strategyUsed[u.id] = {};

  let totalPicks = 0;

  for (const race of races) {
    const sprint = race.hasSprint ? " 🏎 [SPRINT]" : "";
    console.log(`--- ${race.name} (R${race.round})${sprint} ---`);

    // Génération du résultat
    const rr = generateRaceResult(race.hasSprint);
    const driverResults = toDriverResults(rr, race.hasSprint);

    // Sauvegarde RaceResult en DB
    const dbRaceResult = await prisma.raceResult.upsert({
      where: { raceId: race.id },
      update:  { fastestLap: rr.fastestLap, hasRedFlag: rr.hasRedFlag, hasSprintRedFlag: rr.hasSprintRedFlag },
      create:  { raceId: race.id, fastestLap: rr.fastestLap, hasRedFlag: rr.hasRedFlag, hasSprintRedFlag: rr.hasSprintRedFlag },
    });

    // Sauvegarde DriverResults en DB
    for (const dr of driverResults) {
      const scoring = computeDriverScoringStats(dr, rr.fastestLap);
      const baseFields = {
        qualifyingPos:  dr.qualifyingPos,
        racePos:        dr.racePos,
        isDnf:          dr.isDnf,
        sprintQualiPos: dr.sprintQualiPos ?? null,
        sprintRacePos:  dr.sprintRacePos  ?? null,
        sprintIsDnf:    dr.sprintIsDnf,
        ...scoring,
      };
      await prisma.driverResult.upsert({
        where: { raceResultId_driverCode: { raceResultId: dbRaceResult.id, driverCode: dr.driverCode } },
        update: baseFields,
        create: { raceResultId: dbRaceResult.id, driverCode: dr.driverCode, ...baseFields },
      });
    }

    // ── Génération des picks pour tous les joueurs ────────────────────────────
    const picksData: PickData[] = [];
    const picksByUser: Record<string, { driver1: string; driver2: string; team: string; strategy: string }> = {};

    for (const user of users) {
      const shuffled = shuffle(DRIVER_CODES);
      const driver1  = shuffled[0];
      const driver2  = shuffled[1];
      const team     = TEAMS[Math.floor(Math.random() * TEAMS.length)];

      // Stratégie : medium 80% du temps
      let strategy = "medium";
      if (Math.random() < 0.20) {
        const opts = Object.entries(STRATEGY_TOKENS)
          .filter(([code]) => code !== "medium")
          .filter(([code, max]) => (strategyUsed[user.id][code] ?? 0) < max)
          .map(([code]) => code);
        if (opts.length > 0) {
          strategy = opts[Math.floor(Math.random() * opts.length)];
        }
      }
      strategyUsed[user.id][strategy] = (strategyUsed[user.id][strategy] ?? 0) + 1;

      // Sauvegarde du pick en DB
      await prisma.pick.upsert({
        where:  { userId_raceId: { userId: user.id, raceId: race.id } },
        update: { driver1, driver2, team, strategy, drsTarget: null, huileMoteurTarget: null },
        create: { userId: user.id, raceId: race.id, driver1, driver2, team, strategy, drsTarget: null, huileMoteurTarget: null },
      });

      // PickData pour le moteur de scoring (énergie 1.0 pour le demo)
      picksData.push({
        userId: user.id,
        driver1,
        driver2,
        driver1Energy: 1.0,
        driver2Energy: 1.0,
        team,
        strategy,
        drsTarget: null,
        huileMoteurTarget: null,
      });

      picksByUser[user.id] = { driver1, driver2, team, strategy };
      totalPicks++;
    }

    // ── Calcul des scores via le vrai moteur ──────────────────────────────────
    const { scores, breakdowns } = calculateAllScoresWithBreakdown(
      picksData,
      { fastestLap: rr.fastestLap, hasRedFlag: rr.hasRedFlag, hasSprintRedFlag: rr.hasSprintRedFlag, driverResults },
      race.hasSprint
    );

    // Sauvegarde des scores avec breakdown
    for (const user of users) {
      const points    = scores[user.id] ?? 0;
      const breakdown = JSON.stringify(breakdowns[user.id]);
      await prisma.score.upsert({
        where:  { userId_raceId: { userId: user.id, raceId: race.id } },
        update: { points, breakdown },
        create: { userId: user.id, raceId: race.id, points, breakdown },
      });

      const { driver1, driver2, team, strategy } = picksByUser[user.id];
      const stratLabel = strategy === "medium" ? "medium" : `\x1b[33m${strategy}\x1b[0m`;
      console.log(`  ${user.name.padEnd(6)} ${driver1}+${driver2} / ${team.padEnd(12)} / ${stratLabel.padEnd(12)} → ${String(points).padStart(4)} pts`);
    }

    // Résumé du résultat
    const top3  = rr.finishOrder.slice(0, 3).join(" > ");
    const flags = [rr.hasRedFlag ? "🚩course" : "", rr.hasSprintRedFlag ? "🚩sprint" : ""].filter(Boolean).join(" ");
    console.log(`  📊 Arrivée : ${top3}... | FL: ${rr.fastestLap}${rr.dnfs.length ? ` | DNF: ${rr.dnfs.join(",")}` : ""}${flags ? ` | ${flags}` : ""}`);
    if (race.hasSprint) {
      console.log(`  🏎  Sprint : ${rr.sprintFinishOrder.slice(0, 3).join(" > ")}...`);
    }
    console.log();
  }

  // 4. Récapitulatif du classement
  const allScores = await prisma.score.groupBy({
    by: ["userId"],
    _sum: { points: true },
  });

  const demoUserIds = new Set(users.map((u) => u.id));
  const demoScores  = allScores
    .filter((s) => demoUserIds.has(s.userId))
    .sort((a, b) => (b._sum.points ?? 0) - (a._sum.points ?? 0));

  console.log("══════════════════════════════════════");
  console.log("  Classement demo (saison 2026)");
  console.log("══════════════════════════════════════");
  demoScores.forEach((s, i) => {
    const u      = users.find((u) => u.id === s.userId)!;
    const medal  = ["🥇", "🥈", "🥉"][i] ?? `${i + 1}.`;
    console.log(`  ${medal} ${u.name.padEnd(8)} ${s._sum.points} pts`);
  });

  console.log(`\n✅ ${totalPicks} picks créés — ${users.length} joueurs, ${races.length} courses`);
  console.log("   Mot de passe : demo123");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
