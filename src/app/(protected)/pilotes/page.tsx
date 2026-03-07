import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DRIVERS } from "@/lib/constants";
import Image from "next/image";

const TEAM_COLORS: Record<string, string> = {
  "Red Bull":     "#3671C6",
  "McLaren":      "#FF8000",
  "Ferrari":      "#E8002D",
  "Mercedes":     "#00D2BE",
  "Aston Martin": "#229971",
  "Alpine":       "#FF87BC",
  "Williams":     "#64C4FF",
  "RB":           "#6692FF",
  "Audi":         "#C0C0C0",
  "Haas":         "#B6BABD",
  "Cadillac":     "#E10600",
};

type DriverStat = {
  code: string;
  name: string;
  team: string;
  teamColor: string;
  count: number;        // nb de fois sélectionné
  avgTotal: number;     // moyenne points totaux
  avgQuali: number;     // moyenne points qualif
  avgRace: number;      // moyenne points course
  avgSQ: number;        // moyenne points sprint quali
  avgSprint: number;    // moyenne points sprint course
  dnfCount: number;     // nb d'abandons
  totalPosGainPts: number; // pts gagnés sur dépassements (total)
  posLostCount: number; // nb de courses avec perte de place
};

async function getDriverStats(season: number): Promise<DriverStat[]> {
  const now = new Date();
  const [picks, driverResults] = await Promise.all([
    prisma.pick.findMany({
      where: {
        race: {
          season,
          OR: [
            { deadline: { lte: now } },
            { deadline: null, date: { lte: now } },
          ],
        },
      },
      select: { driver1: true, driver2: true },
    }),
    prisma.driverResult.findMany({
      where: { raceResult: { race: { season } } },
      select: {
        driverCode: true,
        isDnf: true,
        scoringQualiPts: true,
        scoringRacePts: true,
        scoringSprintQualiPts: true,
        scoringSprintRacePts: true,
        scoringPosGainPts: true,
        scoringPosLost: true,
      },
    }),
  ]);

  // Comptage total des picks par pilote (TOUS les picks, résultats ou non)
  const pickCounts: Record<string, number> = {};
  for (const pick of picks) {
    pickCounts[pick.driver1] = (pickCounts[pick.driver1] ?? 0) + 1;
    pickCounts[pick.driver2] = (pickCounts[pick.driver2] ?? 0) + 1;
  }

  // Agrégation des stats par pilote depuis DriverResult
  const stats: Record<string, {
    totalPts: number; qualiPts: number; racePts: number;
    sqPts: number; sprintPts: number; scoredCount: number;
    dnf: number; posGainPts: number; posLost: number;
  }> = {};

  for (const dr of driverResults) {
    // Ne compter que les lignes avec au moins une stat de scoring renseignée
    const hasScoring = dr.scoringQualiPts !== null || dr.scoringRacePts !== null;
    if (!stats[dr.driverCode]) {
      stats[dr.driverCode] = { totalPts: 0, qualiPts: 0, racePts: 0, sqPts: 0, sprintPts: 0, scoredCount: 0, dnf: 0, posGainPts: 0, posLost: 0 };
    }
    const s = stats[dr.driverCode];
    if (hasScoring) {
      const q  = dr.scoringQualiPts       ?? 0;
      const r  = dr.scoringRacePts        ?? 0;
      const sq = dr.scoringSprintQualiPts ?? 0;
      const sp = dr.scoringSprintRacePts  ?? 0;
      s.qualiPts   += q;
      s.racePts    += r;
      s.sqPts      += sq;
      s.sprintPts  += sp;
      s.totalPts   += q + r + sq + sp;
      s.scoredCount += 1;
    }
    if (dr.isDnf)           s.dnf      += 1;
    s.posGainPts += dr.scoringPosGainPts ?? 0;
    if (dr.scoringPosLost)  s.posLost  += 1;
  }

  const round1 = (n: number) => Math.round(n * 10) / 10;

  return DRIVERS.map((driver) => {
    const s = stats[driver.code];
    const count = pickCounts[driver.code] ?? 0;
    const n = s?.scoredCount ?? 0;
    return {
      code: driver.code,
      name: driver.name,
      team: driver.team,
      teamColor: TEAM_COLORS[driver.team] ?? "#555",
      count,
      avgTotal:        n > 0 ? round1(s.totalPts  / n) : 0,
      avgQuali:        n > 0 ? round1(s.qualiPts  / n) : 0,
      avgRace:         n > 0 ? round1(s.racePts   / n) : 0,
      avgSQ:           n > 0 ? round1(s.sqPts     / n) : 0,
      avgSprint:       n > 0 ? round1(s.sprintPts / n) : 0,
      dnfCount:        s?.dnf ?? 0,
      totalPosGainPts: n > 0 ? round1(s.posGainPts / n) : 0,
      posLostCount:    s?.posLost ?? 0,
    };
  }).sort((a, b) => b.avgTotal - a.avgTotal);
}

function PodiumCard({
  driver, rank, stepHeight,
}: {
  driver: DriverStat; rank: number; stepHeight: number;
}) {
  const medals = ["🥇", "🥈", "🥉"];
  return (
    <div className="flex flex-col items-center min-w-0">
      <div className="text-white font-bold text-sm sm:text-lg mb-0.5">{driver.avgTotal} pts</div>
      <div className="text-gray-400 text-xs mb-2 sm:mb-3">{driver.count} GP</div>
      <div
        className="relative w-14 h-14 sm:w-24 sm:h-24 rounded-full overflow-hidden mb-2 shrink-0"
        style={{ boxShadow: `0 0 0 3px ${driver.teamColor}` }}
      >
        <Image src={`/${driver.code}.webp`} alt={driver.name} fill className="object-cover object-top" />
      </div>
      <div className="text-white font-semibold text-xs sm:text-sm text-center mb-0.5 px-1 leading-tight">{driver.name}</div>
      <div className="text-xs mb-2 sm:mb-3 truncate max-w-full px-1" style={{ color: driver.teamColor }}>{driver.team}</div>
      <div
        className="w-16 sm:w-28 flex flex-col items-center justify-start pt-2 sm:pt-3 rounded-t-lg font-bold text-xl sm:text-2xl"
        style={{
          height: `${stepHeight}px`,
          background: `linear-gradient(to bottom, ${driver.teamColor}33, ${driver.teamColor}11)`,
          border: `1px solid ${driver.teamColor}44`,
          borderBottom: "none",
        }}
      >
        {medals[rank - 1]}
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">
      {children}
    </th>
  );
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <td className={`px-3 py-2.5 text-sm whitespace-nowrap ${className}`}>{children}</td>
  );
}

function Stat({ value, zero = "—" }: { value: number; zero?: string }) {
  return <span className={value === 0 ? "text-gray-600" : "text-white"}>{value === 0 ? zero : value}</span>;
}

export default async function PilotesPage() {
  await auth();
  const season = new Date().getFullYear();
  const ranking = await getDriverStats(season);

  const hasData = ranking.some((d) => d.count > 0);
  const top3 = ranking.filter((d) => d.count > 0).slice(0, 3);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-bold text-white">Pilotes</h1>
        <p className="text-gray-400 mt-1">Points moyens par week-end — Saison {season}</p>
      </div>

      {!hasData ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-10 text-center">
          <p className="text-gray-400">Aucun résultat enregistré pour le moment.</p>
        </div>
      ) : (
        <>
          {/* Podium */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 sm:p-8">
            <div className="flex items-end justify-center gap-2 sm:gap-6">
              {top3[2] && <PodiumCard driver={top3[2]} rank={3} stepHeight={80} />}
              {top3[0] && <PodiumCard driver={top3[0]} rank={1} stepHeight={130} />}
              {top3[1] && <PodiumCard driver={top3[1]} rank={2} stepHeight={100} />}
            </div>
          </div>

          {/* Tableau détaillé */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <div className="p-6 pb-0">
              <h2 className="text-lg font-semibold text-white mb-1">Statistiques détaillées</h2>
              <p className="text-gray-500 text-xs mb-4">Moyennes calculées sur les GP avec résultats enregistrés</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-gray-800">
                  <tr>
                    <Th>Pilote</Th>
                    <Th>Picks</Th>
                    <Th>Moy. total</Th>
                    <Th>Moy. quali</Th>
                    <Th>Moy. course</Th>
                    <Th>Moy. SQ</Th>
                    <Th>Moy. sprint</Th>
                    <Th>Abandons</Th>
                    <Th>Moy. dépass.</Th>
                    <Th>Pertes place</Th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((driver, i) => (
                    <tr
                      key={driver.code}
                      className={`border-b border-gray-800/50 ${driver.count === 0 ? "opacity-40" : "hover:bg-gray-800/40"}`}
                    >
                      <Td>
                        <div className="flex items-center gap-2.5">
                          <span className="text-gray-600 text-xs w-5 text-right shrink-0">{i + 1}</span>
                          <div
                            className="relative w-8 h-8 rounded-full overflow-hidden shrink-0"
                            style={{ boxShadow: `0 0 0 2px ${driver.teamColor}` }}
                          >
                            <Image src={`/${driver.code}.webp`} alt={driver.name} fill className="object-cover object-top" />
                          </div>
                          <div>
                            <div className="text-white font-medium text-sm leading-tight">{driver.name}</div>
                            <div className="text-xs leading-tight" style={{ color: driver.teamColor }}>{driver.team}</div>
                          </div>
                        </div>
                      </Td>
                      <Td className="text-gray-300 font-medium"><Stat value={driver.count} /></Td>
                      <Td className="font-bold"><Stat value={driver.avgTotal} /></Td>
                      <Td><Stat value={driver.avgQuali} /></Td>
                      <Td><Stat value={driver.avgRace} /></Td>
                      <Td className="text-gray-400"><Stat value={driver.avgSQ} /></Td>
                      <Td className="text-gray-400"><Stat value={driver.avgSprint} /></Td>
                      <Td>
                        {driver.dnfCount > 0
                          ? <span className="text-red-400 font-medium">{driver.dnfCount}</span>
                          : <span className="text-gray-600">—</span>}
                      </Td>
                      <Td>
                        {driver.totalPosGainPts > 0
                          ? <span className="text-green-400 font-medium">+{driver.totalPosGainPts}</span>
                          : <span className="text-gray-600">—</span>}
                      </Td>
                      <Td>
                        {driver.posLostCount > 0
                          ? <span className="text-orange-400 font-medium">{driver.posLostCount}</span>
                          : <span className="text-gray-600">—</span>}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
