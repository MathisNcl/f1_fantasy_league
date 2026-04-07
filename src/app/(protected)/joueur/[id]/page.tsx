import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRemainingTokens } from "@/lib/scoring";
import { DRIVERS, STRATEGIES } from "@/lib/constants";
import Link from "next/link";
import { notFound } from "next/navigation";
import UserRaceHistory from "@/components/profile/UserRaceHistory";
import type { RaceHistoryEntry } from "@/components/profile/UserRaceHistory";

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const now = new Date();
  const currentYear = now.getFullYear();

  const [targetUser, picks, scores, energyRecords, allUsers] = await Promise.all([
    prisma.user.findUnique({ where: { id }, select: { id: true, name: true } }),
    prisma.pick.findMany({
      where: { userId: id },
      include: { race: true },
      orderBy: { race: { date: "desc" } },
    }),
    prisma.score.findMany({ where: { userId: id } }),
    prisma.driverEnergy.findMany({ where: { userId: id, season: currentYear } }),
    prisma.user.findMany({ select: { id: true, name: true } }),
  ]);

  if (!targetUser) notFound();

  const session = await auth();
  const currentUserId = session!.user!.id!;
  const isOwnProfile = currentUserId === id;

  const seasonPicks = picks.filter((p) => p.race.season === currentYear);

  // Pour les profils tiers, on ne compte que les picks dont la deadline est passée
  // pour éviter de révéler la stratégie de la course en cours.
  const picksForTokens = isOwnProfile
    ? seasonPicks
    : seasonPicks.filter((p) => now >= (p.race.deadline ?? p.race.date));
  const remainingTokens = getRemainingTokens(picksForTokens, currentYear);
  const totalPoints = scores.reduce((sum, s) => sum + s.points, 0);

  // Energy map (default 100%)
  const energyMap: Record<string, number> = {};
  for (const d of DRIVERS) energyMap[d.code] = 1.0;
  for (const rec of energyRecords) energyMap[rec.driverCode] = rec.energy;

  // Drivers sorted by energy asc (worst first) then by code
  const driverList = DRIVERS.map((d) => ({
    code: d.code,
    name: d.name,
    team: d.team,
    energy: energyMap[d.code],
  })).sort((a, b) => a.energy - b.energy || a.code.localeCompare(b.code));

  const scoresByRaceId = new Map(scores.map((s) => [s.raceId, s]));
  const userNameById = new Map(allUsers.map((u) => [u.id, u.name]));

  // Race history: only show picks where deadline has passed
  const raceHistory: RaceHistoryEntry[] = picks
    .filter((p) => now >= (p.race.deadline ?? p.race.date))
    .map((p) => {
      const score = scoresByRaceId.get(p.raceId);
      return {
        raceId: p.raceId,
        raceName: p.race.name,
        raceDate: p.race.date.toISOString(),
        driver1: p.driver1,
        driver2: p.driver2,
        team: p.team,
        strategy: p.strategy,
        drsTarget: p.drsTarget,
        drsTargetName: p.drsTarget ? (userNameById.get(p.drsTarget) ?? null) : null,
        huileMoteurTarget: p.huileMoteurTarget,
        score: score?.points ?? null,
        breakdown: score?.breakdown ?? null,
      };
    });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Link href="/dashboard" className="text-gray-400 hover:text-white text-sm transition-colors">
          ← Dashboard
        </Link>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">
            {targetUser.name}
            {isOwnProfile && <span className="ml-3 text-base text-red-400 font-normal">(vous)</span>}
          </h1>
          <p className="text-gray-400 mt-1">Saison {currentYear}</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-white">{totalPoints}</div>
          <div className="text-gray-400 text-sm">points au total</div>
        </div>
      </div>

      {/* Stratégies restantes */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Stratégies restantes</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {STRATEGIES.map((s) => {
            const remaining = remainingTokens[s.code] ?? 0;
            const isEmpty = remaining === 0;
            return (
              <div
                key={s.code}
                className={`rounded-lg border p-3 transition-opacity ${
                  isEmpty ? "opacity-40 border-gray-700 bg-gray-800/30" : "border-gray-700 bg-gray-800"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-white text-sm font-medium">{s.label}</span>
                  <span className={`text-sm font-bold ${isEmpty ? "text-gray-500" : "text-white"}`}>
                    {remaining}/{s.tokens}
                  </span>
                </div>
                <p className="text-gray-400 text-xs leading-tight">{s.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Énergie des pilotes */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Énergie des pilotes</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {driverList.map((d) => {
            const pct = Math.round(d.energy * 100);
            const colorText =
              d.energy >= 0.9 ? "text-green-400" :
              d.energy >= 0.7 ? "text-yellow-400" :
              d.energy >= 0.5 ? "text-orange-400" : "text-red-400";
            const colorBg =
              d.energy >= 0.9 ? "bg-green-900/20 border-green-800/40" :
              d.energy >= 0.7 ? "bg-yellow-900/20 border-yellow-800/40" :
              d.energy >= 0.5 ? "bg-orange-900/20 border-orange-800/40" : "bg-red-900/20 border-red-800/40";
            return (
              <div key={d.code} className={`rounded-lg border px-3 py-2 flex items-center justify-between ${colorBg}`}>
                <div className="min-w-0">
                  <div className="text-white text-sm font-medium">{d.code}</div>
                  <div className="text-gray-400 text-xs truncate">{d.team}</div>
                </div>
                <span className={`text-sm font-bold ml-2 shrink-0 ${colorText}`}>{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Historique des courses */}
      <UserRaceHistory races={raceHistory} />
    </div>
  );
}
