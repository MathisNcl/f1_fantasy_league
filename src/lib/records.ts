import { prisma } from "@/lib/prisma";
import type { ScoreBreakdown } from "@/lib/scoring";
import { DRIVERS, STRATEGIES } from "@/lib/constants";

type UserRef = { id: string; name: string };
type RaceRef = { id: number; name: string; round: number; season: number };

// `baseTotal` n'est pas déclaré dans ScoreBreakdown mais est présent dans le
// JSON stocké (fuite du spread côté scoring.ts) : score avant DRS/undercut.
type StoredBreakdown = ScoreBreakdown & { baseTotal?: number };

export type RaceRecord = {
  user: UserRef;
  race: RaceRef;
  value: number;
};

export type Records = {
  bestScore: RaceRecord[];
  worstScore: RaceRecord[];
  bestStrategyGain: { user: UserRef; race: RaceRef; strategy: string; gain: number }[];
  bestUndercut: { user: UserRef; race: RaceRef; damage: number }[];
  mostMissedRaces: { user: UserRef; count: number }[];
  mostPickedDriverByUser: { user: UserRef; driverCode: string; count: number }[];
  chouchou: { driverCode: string; count: number }[];
  moutonsNoirs: string[];
  bestComeback: {
    user: UserRef;
    season: number;
    race: RaceRef;
    fromRank: number;
    toRank: number;
  }[];
  bestStreak: {
    user: UserRef;
    season: number;
    length: number;
    startRace: RaceRef;
    endRace: RaceRef;
  }[];
  mostDnf: { user: UserRef; count: number }[];
  teamLoyalty: { user: UserRef; team: string; count: number }[];
  theBoss: { user: UserRef; weeks: number }[];
  alwaysLast: { user: UserRef; weeks: number }[];
  speedrunner: { user: UserRef; avgHours: number }[];
  lastMinute: { user: UserRef; avgHours: number }[];
  mrConstance: { user: UserRef; stdDev: number; races: number }[];
  rollercoaster: { user: UserRef; stdDev: number; races: number }[];
  mostWins: { user: UserRef; count: number }[];
  mostPodiums: { user: UserRef; count: number }[];
};

// Renvoie toutes les entrées à égalité sur la valeur extrême (gère les ex æquo).
function topByValue<T>(items: T[], valueOf: (item: T) => number, mode: "max" | "min" = "max"): T[] {
  if (items.length === 0) return [];
  let best = valueOf(items[0]);
  for (const item of items) {
    const v = valueOf(item);
    if (mode === "max" ? v > best : v < best) best = v;
  }
  return items.filter((item) => valueOf(item) === best);
}

function parseBreakdown(raw: string | null): StoredBreakdown | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredBreakdown;
  } catch {
    return null;
  }
}

const STRATEGY_LABEL = new Map<string, string>(STRATEGIES.map((s) => [s.code, s.label]));

// Points gagnés grâce au multiplicateur/bonus propre à la stratégie jouée
// (soft, hard, ultra_tendre, super_dur, pluie), par rapport à ce que le
// joueur aurait obtenu avec une stratégie neutre (medium), toutes choses
// égales par ailleurs (mêmes résultats, même énergie, même bonus d'équipe).
function computeStrategyGain(bd: StoredBreakdown, strategy: string): number {
  if (bd.fiaCancelled) return 0;
  const actualTotal = bd.baseTotal ?? bd.total;

  const applyEnergyLike = (raw: number, energy: number) => (raw > 0 ? raw * energy : raw);

  if (strategy === "super_dur") {
    return Math.round(bd.superDurPts);
  }

  if (strategy === "pluie") {
    if (!bd.pluieActivated) return 0;
    const neutralTotal = actualTotal / 2;
    return Math.round(actualTotal - neutralTotal);
  }

  if (strategy === "soft" || strategy === "hard") {
    const extra = (d: ScoreBreakdown["d1"]) =>
      strategy === "soft" ? d.qualiPts / 2 + d.sprintQualiPts / 2 : d.racePts / 2 + d.sprintRacePts / 2;

    const d1Neutral = applyEnergyLike(bd.d1.rawContrib - extra(bd.d1), bd.d1.energy);
    const d2Neutral = applyEnergyLike(bd.d2.rawContrib - extra(bd.d2), bd.d2.energy);
    const neutralTotal = d1Neutral + d2Neutral + bd.teamPts + bd.sprintTeamPts + bd.bonusPts;
    return Math.round(actualTotal - neutralTotal);
  }

  if (strategy === "ultra_tendre") {
    const extra = (d: ScoreBreakdown["d1"]) => d.posGainPts - Math.min(d.posGain, 10);
    const d1Neutral = applyEnergyLike(bd.d1.rawContrib - extra(bd.d1), bd.d1.energy);
    const d2Neutral = applyEnergyLike(bd.d2.rawContrib - extra(bd.d2), bd.d2.energy);
    const neutralTotal = d1Neutral + d2Neutral + bd.teamPts + bd.sprintTeamPts + bd.bonusPts;
    return Math.round(actualTotal - neutralTotal);
  }

  return 0;
}

export async function getRecords(): Promise<Records> {
  const [users, races, picks, scoreRows] = await Promise.all([
    prisma.user.findMany({ select: { id: true, name: true, createdAt: true } }),
    prisma.race.findMany({
      select: { id: true, name: true, round: true, season: true, date: true, deadline: true },
      orderBy: [{ season: "asc" }, { date: "asc" }],
    }),
    prisma.pick.findMany({
      select: {
        userId: true, raceId: true, driver1: true, driver2: true,
        strategy: true, team: true, createdAt: true,
      },
    }),
    prisma.score.findMany({
      select: { userId: true, raceId: true, points: true, breakdown: true },
    }),
  ]);

  const userMap = new Map(users.map((u) => [u.id, { id: u.id, name: u.name }]));
  const raceMap = new Map(races.map((r) => [r.id, r]));
  const toRaceRef = (raceId: number): RaceRef => {
    const r = raceMap.get(raceId)!;
    return { id: r.id, name: r.name, round: r.round, season: r.season };
  };

  const scores = scoreRows.map((s) => ({
    ...s,
    bd: parseBreakdown(s.breakdown),
  }));

  // ---------------------------------------------------------------------
  // Meilleur / pire score sur un GP
  // ---------------------------------------------------------------------
  const scoreCandidates: RaceRecord[] = scores.map((s) => ({
    user: userMap.get(s.userId)!,
    race: toRaceRef(s.raceId),
    value: s.points,
  }));
  const bestScore = topByValue(scoreCandidates, (c) => c.value, "max");
  const worstScore = topByValue(scoreCandidates, (c) => c.value, "min");

  // ---------------------------------------------------------------------
  // Meilleur gain de points grâce à une stratégie (soft/hard/ultra_tendre/
  // super_dur/pluie) : points obtenus en plus par rapport à une semaine neutre
  // ---------------------------------------------------------------------
  const pickByUserRace = new Map(picks.map((p) => [`${p.userId}:${p.raceId}`, p]));
  const strategyGainCandidates: Records["bestStrategyGain"] = [];
  for (const s of scores) {
    if (!s.bd) continue;
    const pick = pickByUserRace.get(`${s.userId}:${s.raceId}`);
    if (!pick) continue;
    const gain = computeStrategyGain(s.bd, pick.strategy);
    if (gain <= 0) continue;
    strategyGainCandidates.push({
      user: userMap.get(s.userId)!,
      race: toRaceRef(s.raceId),
      strategy: STRATEGY_LABEL.get(pick.strategy) ?? pick.strategy,
      gain,
    });
  }
  const bestStrategyGain = topByValue(strategyGainCandidates, (c) => c.gain, "max");

  // ---------------------------------------------------------------------
  // Meilleur undercut : dégâts totaux infligés lors d'un GP joué en undercut
  // ---------------------------------------------------------------------
  const damageByRace = new Map<number, number>();
  for (const s of scores) {
    if (!s.bd) continue;
    const dmg = Math.abs(s.bd.undercutLoss);
    if (dmg > 0) damageByRace.set(s.raceId, (damageByRace.get(s.raceId) ?? 0) + dmg);
  }
  const undercutCandidates: Records["bestUndercut"] = [];
  for (const p of picks) {
    if (p.strategy !== "undercut") continue;
    const damage = damageByRace.get(p.raceId) ?? 0;
    if (damage <= 0) continue;
    undercutCandidates.push({ user: userMap.get(p.userId)!, race: toRaceRef(p.raceId), damage });
  }
  const bestUndercut = topByValue(undercutCandidates, (c) => c.damage, "max");

  // ---------------------------------------------------------------------
  // GP loupés (pas de pick soumis alors que la deadline est passée)
  // ---------------------------------------------------------------------
  const now = new Date();
  const pickSet = new Set(picks.map((p) => `${p.userId}:${p.raceId}`));
  const missedByUser = new Map<string, number>();
  for (const user of users) {
    let count = 0;
    for (const race of races) {
      const deadline = race.deadline ?? race.date;
      if (deadline > now) continue;
      if (race.date < user.createdAt) continue;
      if (!pickSet.has(`${user.id}:${race.id}`)) count++;
    }
    if (count > 0) missedByUser.set(user.id, count);
  }
  const mostMissedRaces = topByValue(
    Array.from(missedByUser, ([userId, count]) => ({ user: userMap.get(userId)!, count })),
    (c) => c.count,
    "max"
  );

  // ---------------------------------------------------------------------
  // Pilote le plus pické par un même joueur / chouchou / moutons noirs
  // ---------------------------------------------------------------------
  const pickCountByUserDriver = new Map<string, number>();
  const pickCountByDriver = new Map<string, number>();
  for (const p of picks) {
    for (const code of [p.driver1, p.driver2]) {
      const key = `${p.userId}:${code}`;
      pickCountByUserDriver.set(key, (pickCountByUserDriver.get(key) ?? 0) + 1);
      pickCountByDriver.set(code, (pickCountByDriver.get(code) ?? 0) + 1);
    }
  }
  const mostPickedDriverByUser = topByValue(
    Array.from(pickCountByUserDriver, ([key, count]) => {
      const [userId, driverCode] = key.split(":");
      return { user: userMap.get(userId)!, driverCode, count };
    }),
    (c) => c.count,
    "max"
  );

  const chouchou = topByValue(
    Array.from(pickCountByDriver, ([driverCode, count]) => ({ driverCode, count })),
    (c) => c.count,
    "max"
  );

  const moutonsNoirs = DRIVERS.filter((d) => !pickCountByDriver.has(d.code)).map((d) => d.code);

  // ---------------------------------------------------------------------
  // Fidèle à l'écurie : équipe la plus souvent choisie par un même joueur
  // ---------------------------------------------------------------------
  const teamCountByUser = new Map<string, number>();
  for (const p of picks) {
    const key = `${p.userId}:${p.team}`;
    teamCountByUser.set(key, (teamCountByUser.get(key) ?? 0) + 1);
  }
  const teamLoyalty = topByValue(
    Array.from(teamCountByUser, ([key, count]) => {
      const [userId, team] = key.split(":");
      return { user: userMap.get(userId)!, team, count };
    }),
    (c) => c.count,
    "max"
  );

  // ---------------------------------------------------------------------
  // GP gagnés / podiums : classement hebdomadaire entre joueurs (classement
  // dense, gère les égalités de points au sein d'un même GP)
  // ---------------------------------------------------------------------
  const scoresByRace = new Map<number, typeof scores>();
  for (const s of scores) {
    if (!scoresByRace.has(s.raceId)) scoresByRace.set(s.raceId, []);
    scoresByRace.get(s.raceId)!.push(s);
  }
  const winsByUser = new Map<string, number>();
  const podiumsByUser = new Map<string, number>();
  for (const raceScores of scoresByRace.values()) {
    const distinctValues = Array.from(new Set(raceScores.map((s) => s.points))).sort((a, b) => b - a);
    const rankOf = new Map(distinctValues.map((v, i) => [v, i + 1]));
    for (const s of raceScores) {
      const rank = rankOf.get(s.points)!;
      if (rank === 1) winsByUser.set(s.userId, (winsByUser.get(s.userId) ?? 0) + 1);
      if (rank <= 3) podiumsByUser.set(s.userId, (podiumsByUser.get(s.userId) ?? 0) + 1);
    }
  }
  const mostWins = topByValue(
    Array.from(winsByUser, ([userId, count]) => ({ user: userMap.get(userId)!, count })),
    (c) => c.count,
    "max"
  );
  const mostPodiums = topByValue(
    Array.from(podiumsByUser, ([userId, count]) => ({ user: userMap.get(userId)!, count })),
    (c) => c.count,
    "max"
  );

  // ---------------------------------------------------------------------
  // Comeback + série (streak top 3) + patron / choux — calculés par saison
  // via le classement général cumulé après chaque GP
  // ---------------------------------------------------------------------
  const seasons = Array.from(new Set(races.map((r) => r.season))).sort();
  const comebackCandidates: Records["bestComeback"] = [];
  const streakCandidates: Records["bestStreak"] = [];
  const weeksAtTop = new Map<string, number>();
  const weeksLast = new Map<string, number>();

  for (const season of seasons) {
    const seasonRaces = races.filter((r) => r.season === season);
    const scoresBySeasonRace = new Map<number, typeof scores>();
    for (const s of scores) {
      const race = raceMap.get(s.raceId);
      if (!race || race.season !== season) continue;
      if (!scoresBySeasonRace.has(s.raceId)) scoresBySeasonRace.set(s.raceId, []);
      scoresBySeasonRace.get(s.raceId)!.push(s);
    }
    const scoredRaces = seasonRaces
      .filter((r) => scoresBySeasonRace.has(r.id))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    const cumulative = new Map<string, number>();
    let previousRanks: Map<string, number> | null = null;
    const currentStreak = new Map<string, number>();
    const streakStart = new Map<string, RaceRef>();

    for (const race of scoredRaces) {
      for (const s of scoresBySeasonRace.get(race.id)!) {
        cumulative.set(s.userId, (cumulative.get(s.userId) ?? 0) + s.points);
      }

      const ranked = Array.from(cumulative.entries()).sort((a, b) => b[1] - a[1]);
      const currentRanks = new Map<string, number>();
      ranked.forEach(([userId], i) => currentRanks.set(userId, i + 1));

      if (previousRanks) {
        for (const [userId, rank] of currentRanks) {
          const prevRank = previousRanks.get(userId);
          if (prevRank === undefined) continue;
          const gain = prevRank - rank;
          if (gain > 0) {
            comebackCandidates.push({
              user: userMap.get(userId)!,
              season,
              race: { id: race.id, name: race.name, round: race.round, season: race.season },
              fromRank: prevRank,
              toRank: rank,
            });
          }
        }
      }

      const lastRank = currentRanks.size;
      for (const [userId, rank] of currentRanks) {
        if (rank === 1) {
          weeksAtTop.set(userId, (weeksAtTop.get(userId) ?? 0) + 1);
        }
        if (rank === lastRank && lastRank >= 2) {
          weeksLast.set(userId, (weeksLast.get(userId) ?? 0) + 1);
        }
      }

      for (const [userId, rank] of currentRanks) {
        if (rank <= 3) {
          const prevLen = currentStreak.get(userId) ?? 0;
          if (prevLen === 0) {
            streakStart.set(userId, { id: race.id, name: race.name, round: race.round, season: race.season });
          }
          const newLen = prevLen + 1;
          currentStreak.set(userId, newLen);
          streakCandidates.push({
            user: userMap.get(userId)!,
            season,
            length: newLen,
            startRace: streakStart.get(userId)!,
            endRace: { id: race.id, name: race.name, round: race.round, season: race.season },
          });
        } else {
          currentStreak.set(userId, 0);
        }
      }

      previousRanks = currentRanks;
    }
  }

  const bestComeback = topByValue(comebackCandidates, (c) => c.fromRank - c.toRank, "max");
  const bestStreak = topByValue(streakCandidates, (c) => c.length, "max");
  const theBoss = topByValue(
    Array.from(weeksAtTop, ([userId, weeks]) => ({ user: userMap.get(userId)!, weeks })),
    (c) => c.weeks,
    "max"
  );
  const alwaysLast = topByValue(
    Array.from(weeksLast, ([userId, weeks]) => ({ user: userMap.get(userId)!, weeks })),
    (c) => c.weeks,
    "max"
  );

  // ---------------------------------------------------------------------
  // Speedrunner / dernière minute : délai moyen entre soumission du pick
  // et la deadline du GP
  // ---------------------------------------------------------------------
  const leadHoursByUser = new Map<string, number[]>();
  for (const p of picks) {
    const race = raceMap.get(p.raceId);
    if (!race) continue;
    const deadline = race.deadline ?? race.date;
    const hours = (deadline.getTime() - p.createdAt.getTime()) / 3_600_000;
    if (!leadHoursByUser.has(p.userId)) leadHoursByUser.set(p.userId, []);
    leadHoursByUser.get(p.userId)!.push(hours);
  }
  const MIN_PICKS_FOR_TIMING = 3;
  const timingEntries = Array.from(leadHoursByUser, ([userId, hoursList]) => ({
    user: userMap.get(userId)!,
    avgHours: hoursList.reduce((a, b) => a + b, 0) / hoursList.length,
    count: hoursList.length,
  })).filter((e) => e.count >= MIN_PICKS_FOR_TIMING);
  const speedrunner = topByValue(timingEntries, (c) => c.avgHours, "max").map(({ user, avgHours }) => ({ user, avgHours }));
  const lastMinute = topByValue(timingEntries, (c) => c.avgHours, "min").map(({ user, avgHours }) => ({ user, avgHours }));

  // ---------------------------------------------------------------------
  // Mr Constance / Montagnes russes : écart-type des points par GP
  // ---------------------------------------------------------------------
  const pointsByUser = new Map<string, number[]>();
  for (const s of scores) {
    if (!pointsByUser.has(s.userId)) pointsByUser.set(s.userId, []);
    pointsByUser.get(s.userId)!.push(s.points);
  }
  const MIN_RACES_FOR_STDDEV = 5;
  const stdDevEntries = Array.from(pointsByUser, ([userId, pts]) => {
    const mean = pts.reduce((a, b) => a + b, 0) / pts.length;
    const variance = pts.reduce((a, b) => a + (b - mean) ** 2, 0) / pts.length;
    return { user: userMap.get(userId)!, stdDev: Math.sqrt(variance), races: pts.length };
  }).filter((e) => e.races >= MIN_RACES_FOR_STDDEV);
  const mrConstance = topByValue(stdDevEntries, (c) => c.stdDev, "min");
  const rollercoaster = topByValue(stdDevEntries, (c) => c.stdDev, "max");

  // ---------------------------------------------------------------------
  // Guigne pure : DNF cumulés sur ses picks
  // ---------------------------------------------------------------------
  const dnfByUser = new Map<string, number>();
  for (const s of scores) {
    if (!s.bd) continue;
    let dnf = 0;
    if (s.bd.d1.hasDnf) dnf++;
    if (s.bd.d2.hasDnf) dnf++;
    if (dnf > 0) dnfByUser.set(s.userId, (dnfByUser.get(s.userId) ?? 0) + dnf);
  }
  const mostDnf = topByValue(
    Array.from(dnfByUser, ([userId, count]) => ({ user: userMap.get(userId)!, count })),
    (c) => c.count,
    "max"
  );

  return {
    bestScore,
    worstScore,
    bestStrategyGain,
    bestUndercut,
    mostMissedRaces,
    mostPickedDriverByUser,
    chouchou,
    moutonsNoirs,
    bestComeback,
    bestStreak,
    mostDnf,
    teamLoyalty,
    theBoss,
    alwaysLast,
    speedrunner,
    lastMinute,
    mrConstance,
    rollercoaster,
    mostWins,
    mostPodiums,
  };
}
