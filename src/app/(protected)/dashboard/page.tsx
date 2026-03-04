import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Leaderboard from "@/components/dashboard/Leaderboard";
import PicksForm from "@/components/dashboard/PicksForm";
import MyPicksHistory from "@/components/dashboard/MyPicksHistory";
import LastRaceRecap from "@/components/dashboard/LastRaceRecap";
import NextRacePicksStatus from "@/components/dashboard/NextRacePicksStatus";
import { getRemainingTokens } from "@/lib/scoring";
import { DRIVERS } from "@/lib/constants";

async function getNextRace() {
  const now = new Date();
  return prisma.race.findFirst({
    where: {
      date: { gt: now },
      season: now.getFullYear(),
    },
    orderBy: { date: "asc" },
  });
}

async function getLeaderboard() {
  const scores = await prisma.score.groupBy({
    by: ["userId"],
    _sum: { points: true },
    _count: { id: true },
  });

  const userIds = scores.map((s) => s.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true },
  });

  return scores
    .map((s) => ({
      userId: s.userId,
      name: users.find((u) => u.id === s.userId)?.name ?? "Inconnu",
      totalPoints: s._sum.points ?? 0,
      pickCount: s._count.id,
    }))
    .sort((a, b) => b.totalPoints - a.totalPoints);
}

async function getMyPicks(userId: string) {
  const picks = await prisma.pick.findMany({
    where: { userId },
    include: { race: true },
    orderBy: { race: { date: "desc" } },
  });

  const scores = await prisma.score.findMany({ where: { userId } });

  return picks.map((pick) => ({
    ...pick,
    score: scores.find((s) => s.raceId === pick.raceId) ?? null,
  }));
}

async function getMyPickForRace(userId: string, raceId: number) {
  return prisma.pick.findUnique({
    where: { userId_raceId: { userId, raceId } },
  });
}

async function getNextRacePicksStatus(raceId: number) {
  const [allUsers, picks] = await Promise.all([
    prisma.user.findMany({ select: { id: true, name: true } }),
    prisma.pick.findMany({ where: { raceId }, select: { userId: true } }),
  ]);
  const pickUserIds = new Set(picks.map((p) => p.userId));
  return allUsers.map((u) => ({ id: u.id, name: u.name, hasPick: pickUserIds.has(u.id) }));
}

async function getLastRaceRecap(currentYear: number, nextRaceId: number | undefined) {
  // Dernière course avec un résultat enregistré (hors prochaine course)
  const lastRace = await prisma.race.findFirst({
    where: {
      season: currentYear,
      result: { isNot: null },
      ...(nextRaceId ? { id: { not: nextRaceId } } : {}),
    },
    orderBy: { date: "desc" },
  });

  if (!lastRace) return null;

  const [picks, scores, allUsers] = await Promise.all([
    prisma.pick.findMany({
      where: { raceId: lastRace.id },
    }),
    prisma.score.findMany({
      where: { raceId: lastRace.id },
    }),
    prisma.user.findMany({
      select: { id: true, name: true },
    }),
  ]);

  const entries = picks
    .map((p) => {
      const drsTargetUser = p.drsTarget
        ? allUsers.find((u) => u.id === p.drsTarget)
        : null;
      const scoreRecord = scores.find((s) => s.userId === p.userId);
      return {
        userId: p.userId,
        userName: allUsers.find((u) => u.id === p.userId)?.name ?? "Inconnu",
        driver1: p.driver1,
        driver2: p.driver2,
        team: p.team,
        strategy: p.strategy,
        drsTarget: p.drsTarget,
        drsTargetName: drsTargetUser?.name ?? null,
        huileMoteurTarget: p.huileMoteurTarget,
        score: scoreRecord?.points ?? null,
        breakdown: scoreRecord?.breakdown ?? null,
      };
    })
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  return { race: lastRace, entries };
}

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user!.id!;
  const currentYear = new Date().getFullYear();

  const [nextRace, leaderboard, myPicks, allUsers] = await Promise.all([
    getNextRace(),
    getLeaderboard(),
    getMyPicks(userId),
    prisma.user.findMany({
      where: { id: { not: userId } },
      select: { id: true, name: true },
    }),
  ]);

  const [existingPick, lastRaceRecap, picksStatus] = await Promise.all([
    nextRace ? getMyPickForRace(userId, nextRace.id) : Promise.resolve(null),
    getLastRaceRecap(currentYear, nextRace?.id),
    nextRace ? getNextRacePicksStatus(nextRace.id) : Promise.resolve([]),
  ]);

  // Picks de la saison courante, hors pick de la prochaine course
  const pastSeasonPicks = myPicks.filter(
    (p) => p.race.season === currentYear && p.raceId !== nextRace?.id
  );

  // Tokens restants par stratégie (picks validés sauf le pick courant)
  const remainingTokens = getRemainingTokens(pastSeasonPicks, currentYear);

  // Énergie courante par pilote (pour afficher dans le formulaire de picks)
  const energyRecords = await prisma.driverEnergy.findMany({
    where: { userId, season: currentYear },
  });
  const energyMap: Record<string, number> = {};
  for (const driver of DRIVERS) {
    energyMap[driver.code] = 1.0; // 100% par défaut
  }
  for (const rec of energyRecords) {
    energyMap[rec.driverCode] = rec.energy;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 mt-1">Saison {currentYear}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Prochain GP - Formulaire de picks */}
        <div>
          {nextRace ? (
            <PicksForm
              race={nextRace}
              existingPick={existingPick}
              energyMap={energyMap}
              remainingTokens={remainingTokens}
              otherUsers={allUsers}
            />
          ) : (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <h2 className="text-xl font-semibold text-white mb-2">
                Prochain Grand Prix
              </h2>
              <p className="text-gray-400">
                Aucune course à venir pour cette saison.
              </p>
            </div>
          )}
        </div>

        {/* Classement + Dernier week-end */}
        <div className="space-y-8">
          <Leaderboard entries={leaderboard} currentUserId={userId} />

          {lastRaceRecap && (
            <LastRaceRecap
              race={lastRaceRecap.race}
              entries={lastRaceRecap.entries}
              currentUserId={userId}
            />
          )}
        </div>
      </div>

      {/* Statut des paris pour le prochain GP */}
      {nextRace && picksStatus.length > 0 && (
        <NextRacePicksStatus
          raceName={nextRace.name}
          entries={picksStatus.map((p) => ({ ...p, isCurrentUser: p.id === userId }))}
        />
      )}

      {/* Historique des picks */}
      <MyPicksHistory picks={myPicks} />
    </div>
  );
}
