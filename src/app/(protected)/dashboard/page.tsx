import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Leaderboard from "@/components/dashboard/Leaderboard";
import PicksForm from "@/components/dashboard/PicksForm";
import MyPicksHistory from "@/components/dashboard/MyPicksHistory";
import LastRaceRecap from "@/components/dashboard/LastRaceRecap";
import NextRacePicksStatus from "@/components/dashboard/NextRacePicksStatus";
import { getRemainingTokens } from "@/lib/scoring";
import { DRIVERS } from "@/lib/constants";

// Course dont la deadline est passée mais sans résultat encore (week-end en cours)
async function getActiveRace(now: Date, year: number) {
  return prisma.race.findFirst({
    where: {
      season: year,
      result: { is: null },
      OR: [
        { deadline: { lte: now } },
        { deadline: null, date: { lte: now } },
      ],
    },
    orderBy: { date: "desc" },
  });
}

// Prochaine course disponible pour les picks.
// Si une course active existe (week-end en cours), on attend minuit UTC
// du lendemain de sa date avant d'afficher la suivante.
async function getNextPickRace(now: Date, year: number, activeRaceDate: Date | null) {
  if (activeRaceDate) {
    const showAfter = new Date(activeRaceDate);
    showAfter.setUTCDate(showAfter.getUTCDate() + 1);
    showAfter.setUTCHours(0, 0, 0, 0); // minuit UTC ≈ 01h00 CET ≈ lundi matin
    if (now < showAfter) return null;
  }
  return prisma.race.findFirst({
    where: { date: { gt: now }, season: year },
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

async function getRacePicksStatus(raceId: number) {
  const [allUsers, picks] = await Promise.all([
    prisma.user.findMany({ select: { id: true, name: true } }),
    prisma.pick.findMany({
      where: { raceId },
      select: { userId: true, driver1: true, driver2: true, team: true, strategy: true, drsTarget: true },
    }),
  ]);
  const picksByUserId = new Map(picks.map((p) => [p.userId, p]));
  return allUsers.map((u) => ({
    id: u.id,
    name: u.name,
    hasPick: picksByUserId.has(u.id),
    pick: picksByUserId.get(u.id) ?? null,
  }));
}

async function getLastRaceRecap(currentYear: number) {
  const lastRace = await prisma.race.findFirst({
    where: {
      season: currentYear,
      result: { isNot: null },
    },
    orderBy: { date: "desc" },
  });

  if (!lastRace) return null;

  const [picks, scores, allUsers] = await Promise.all([
    prisma.pick.findMany({ where: { raceId: lastRace.id } }),
    prisma.score.findMany({ where: { raceId: lastRace.id } }),
    prisma.user.findMany({ select: { id: true, name: true } }),
  ]);

  const entries = picks
    .map((p) => {
      const drsTargetUser = p.drsTarget ? allUsers.find((u) => u.id === p.drsTarget) : null;
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
  const now = new Date();
  const currentYear = now.getFullYear();

  const activeRace = await getActiveRace(now, currentYear);

  const [nextPickRace, leaderboard, myPicks, allUsers] = await Promise.all([
    getNextPickRace(now, currentYear, activeRace?.date ?? null),
    getLeaderboard(),
    getMyPicks(userId),
    prisma.user.findMany({
      where: { id: { not: userId } },
      select: { id: true, name: true },
    }),
  ]);

  // Course affichée dans NextRacePicksStatus :
  // - activeRace si le week-end est en cours (deadline passée, picks révélés)
  // - sinon nextPickRace si on est en semaine de course (picks cachés avant deadline)
  const raceForStatus = activeRace ?? nextPickRace;

  const [existingPick, lastRaceRecap, picksStatus] = await Promise.all([
    nextPickRace ? getMyPickForRace(userId, nextPickRace.id) : Promise.resolve(null),
    getLastRaceRecap(currentYear),
    raceForStatus ? getRacePicksStatus(raceForStatus.id) : Promise.resolve([]),
  ]);

  // Picks de la saison courante, hors pick de la prochaine course à picker
  const pastSeasonPicks = myPicks.filter(
    (p) => p.race.season === currentYear && p.raceId !== nextPickRace?.id
  );
  const remainingTokens = getRemainingTokens(pastSeasonPicks, currentYear);

  const energyRecords = await prisma.driverEnergy.findMany({
    where: { userId, season: currentYear },
  });
  const energyMap: Record<string, number> = {};
  for (const driver of DRIVERS) energyMap[driver.code] = 1.0;
  for (const rec of energyRecords) energyMap[rec.driverCode] = rec.energy;

  // Afficher le bloc picks status ?
  const showPicksStatus = (() => {
    if (!raceForStatus || picksStatus.length === 0) return false;
    if (activeRace) return true; // semaine de course passée → toujours visible
    if (!nextPickRace) return false;
    const deadline = nextPickRace.deadline ?? nextPickRace.date;
    const msToDeadline = deadline.getTime() - now.getTime();
    return msToDeadline <= 7 * 24 * 60 * 60 * 1000; // dans la semaine du GP
  })();

  // La deadline passée concerne la course affichée dans le bloc status
  const statusDeadlinePassed = activeRace
    ? true
    : nextPickRace
      ? now >= (nextPickRace.deadline ?? nextPickRace.date)
      : false;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 mt-1">Saison {currentYear}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Prochain GP - Formulaire de picks */}
        <div>
          {nextPickRace ? (
            <PicksForm
              race={nextPickRace}
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
                {activeRace
                  ? `Week-end ${activeRace.name} en cours — les paris pour le prochain GP ouvrent lundi.`
                  : "Aucune course à venir pour cette saison."}
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

      {/* Statut des paris */}
      {showPicksStatus && raceForStatus && (
        <NextRacePicksStatus
          raceName={raceForStatus.name}
          deadline={(raceForStatus.deadline ?? raceForStatus.date).toISOString()}
          deadlinePassed={statusDeadlinePassed}
          entries={picksStatus.map((p) => ({
            ...p,
            isCurrentUser: p.id === userId,
            pick: statusDeadlinePassed ? p.pick : null,
          }))}
        />
      )}

      {/* Historique des picks */}
      <MyPicksHistory picks={myPicks} />
    </div>
  );
}
