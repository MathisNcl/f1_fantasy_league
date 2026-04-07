import { DRIVERS, STRATEGIES } from "@/lib/constants";
import { ScoreBreakdown } from "@/lib/scoring";

type Entry = {
  userId: string;
  userName: string;
  driver1: string;
  driver2: string;
  team: string;
  strategy: string;
  drsTarget: string | null;
  drsTargetName: string | null;
  huileMoteurTarget: string | null;
  score: number | null;
  breakdown: string | null;
};

type RaceInfo = {
  name: string;
  round: number;
  location: string;
  date: Date;
  hasSprint: boolean;
};

type Props = {
  race: RaceInfo;
  entries: Entry[];
  currentUserId: string;
};

const STRATEGY_BADGE: Record<string, string> = {
  ultra_tendre: "bg-red-900/60 text-red-300 border-red-800",
  soft:         "bg-yellow-900/60 text-yellow-300 border-yellow-800",
  medium:       "bg-gray-700/60 text-gray-300 border-gray-600",
  hard:         "bg-gray-600/60 text-white border-gray-500",
  super_dur:    "bg-orange-900/60 text-orange-300 border-orange-800",
  pluie:        "bg-blue-900/60 text-blue-300 border-blue-800",
  undercut:     "bg-purple-900/60 text-purple-300 border-purple-800",
  drs:          "bg-green-900/60 text-green-300 border-green-800",
  moteur:       "bg-cyan-900/60 text-cyan-300 border-cyan-800",
  huile_moteur: "bg-orange-900/60 text-orange-300 border-orange-800",
  fia:          "bg-red-900/60 text-red-300 border-red-800",
};

const RANK_COLOR = ["text-yellow-400", "text-gray-300", "text-orange-400"];

function driverName(code: string): string {
  return DRIVERS.find((d) => d.code === code)?.name ?? code;
}

function driverTeam(code: string): string {
  return DRIVERS.find((d) => d.code === code)?.team ?? "";
}

function stratDef(code: string) {
  return STRATEGIES.find((s) => s.code === code);
}

function parseBreakdown(raw: string | null): ScoreBreakdown | null {
  if (!raw) return null;
  try { return JSON.parse(raw) as ScoreBreakdown; } catch { return null; }
}

function fmt(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}

function DriverLine({ d, hasSprint }: { d: ScoreBreakdown["d1"]; hasSprint: boolean }) {
  const energyPct = Math.round(d.energy * 100);
  const hasEnergy = d.energy < 1.0;
  const posGain = d.posGain ?? 0;
  const posGainPts = d.posGainPts ?? 0;
  const posLost = d.posLost ?? false;
  const hasDnf = d.hasDnf ?? false;
  const hasFl = d.hasFastestLap ?? false;
  return (
    <div>
      <p className="text-gray-500 text-xs mb-0.5">{d.code}</p>
      <p className="text-white text-xs">
        Q:{fmt(d.qualiPts)}
        {hasSprint && (d.sprintQualiPts > 0 || d.sprintRacePts > 0) && (
          <> · SQ:{fmt(d.sprintQualiPts)} SR:{fmt(d.sprintRacePts)}</>
        )}
        {" · "}C:{fmt(d.racePts)}
        {hasDnf && <span className="text-red-400"> (DNF −5)</span>}
        {hasFl && <span className="text-purple-400"> (FL +2)</span>}
        {posGain > 0 && <span className="text-green-400"> (+{posGain}pl +{posGainPts})</span>}
        {posLost && <span className="text-orange-400"> (perte −2)</span>}
        {(d.tailPenalty ?? 0) < 0 && <span className="text-red-400"> (queue {d.tailPenalty})</span>}
        {" = "}
        <span className="text-gray-300">{fmt(d.rawContrib)}</span>
      </p>
      {hasEnergy ? (
        <p className="text-yellow-400 text-xs">⚡{energyPct}% → {fmt(d.finalContrib)} pts</p>
      ) : (
        <p className="text-gray-400 text-xs">⚡100% → {fmt(d.finalContrib)} pts</p>
      )}
    </div>
  );
}

export default function LastRaceRecap({ race, entries, currentUserId }: Props) {
  const raceDate = new Date(race.date);
  const dateLabel = raceDate.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
      {/* En-tête */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Dernier week-end</h2>
          <p className="text-red-400 font-medium text-sm mt-0.5">{race.name}</p>
        </div>
        <div className="text-right">
          <p className="text-gray-400 text-xs">{race.location}</p>
          <p className="text-gray-500 text-xs mt-0.5">{dateLabel}</p>
          {race.hasSprint && (
            <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-bold bg-purple-900 text-purple-300 border border-purple-700">
              SPRINT
            </span>
          )}
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="text-gray-400 text-sm">Aucun pick pour cette course.</p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, index) => {
            const strat = stratDef(entry.strategy);
            const badgeClass = STRATEGY_BADGE[entry.strategy] ?? STRATEGY_BADGE.medium;
            const isMe = entry.userId === currentUserId;
            const rankColor = RANK_COLOR[index] ?? "text-gray-500";
            const bd = parseBreakdown(entry.breakdown);

            return (
              <div key={entry.userId} className="relative group">
                <div
                  className={`px-4 py-3 rounded-lg cursor-default transition-colors ${
                    isMe
                      ? "bg-red-950 border border-red-800"
                      : "bg-gray-800 hover:bg-gray-750"
                  }`}
                >
                  {/* Ligne 1 : Rang · Nom · Score */}
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold w-5 text-center shrink-0 ${rankColor}`}>
                      {index + 1}
                    </span>
                    <span className="text-white font-medium text-sm flex-1 truncate">
                      {entry.userName}
                      {isMe && (
                        <span className="ml-1.5 text-red-400 text-xs font-normal">vous</span>
                      )}
                    </span>
                    <span className="text-white font-bold text-sm shrink-0">
                      {entry.score !== null ? `${entry.score} pts` : "—"}
                    </span>
                  </div>

                  {/* Ligne 2 : Pilotes · Écurie · Stratégie */}
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap pl-7">
                    {/* Driver 1 */}
                    <span className="bg-gray-700 text-gray-200 text-xs font-mono px-2 py-0.5 rounded">
                      {entry.driver1}
                    </span>
                    <span className="text-gray-600 text-xs">+</span>
                    {/* Driver 2 */}
                    <span className="bg-gray-700 text-gray-200 text-xs font-mono px-2 py-0.5 rounded">
                      {entry.driver2}
                    </span>
                    <span className="text-gray-700 text-xs">·</span>
                    {/* Écurie */}
                    <span className="text-gray-400 text-xs">{entry.team}</span>
                    <span className="text-gray-700 text-xs">·</span>
                    {/* Stratégie */}
                    <span className={`text-xs px-2 py-0.5 rounded border ${badgeClass}`}>
                      {strat?.label ?? entry.strategy}
                    </span>
                  </div>
                </div>

                {/* Tooltip desktop au hover (caché sur touch) */}
                <div className="absolute left-0 right-0 top-full mt-1 z-20 hidden group-hover:block pointer-events-none">
                  <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-4 text-sm">
                    {/* Picks info */}
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                      <div>
                        <p className="text-gray-500 text-xs mb-0.5">Pilote 1</p>
                        <p className="text-white font-medium text-sm">{driverName(entry.driver1)}</p>
                        <p className="text-gray-400 text-xs">{driverTeam(entry.driver1)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs mb-0.5">Pilote 2</p>
                        <p className="text-white font-medium text-sm">{driverName(entry.driver2)}</p>
                        <p className="text-gray-400 text-xs">{driverTeam(entry.driver2)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs mb-0.5">Écurie</p>
                        <p className="text-white font-medium text-sm">{entry.team}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs mb-0.5">Stratégie</p>
                        <span className={`text-xs px-2 py-0.5 rounded border ${badgeClass}`}>
                          {strat?.label ?? entry.strategy}
                        </span>
                        {strat && (
                          <p className="text-gray-400 text-xs mt-1 leading-snug">{strat.description}</p>
                        )}
                        {entry.strategy === "drs" && entry.drsTargetName && (
                          <p className="text-green-400 text-xs mt-0.5">Cible : {entry.drsTargetName}</p>
                        )}
                        {entry.strategy === "huile_moteur" && entry.huileMoteurTarget && (
                          <p className="text-orange-400 text-xs mt-0.5">Boosté : {entry.huileMoteurTarget}</p>
                        )}
                      </div>
                    </div>

                    {/* Détail des points */}
                    {bd && (
                      <div className="border-t border-gray-700 mt-3 pt-3">
                        <p className="text-gray-500 text-xs mb-2 uppercase tracking-wide">Détail des points</p>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-2 mb-2">
                          <DriverLine d={bd.d1} hasSprint={race.hasSprint} />
                          <DriverLine d={bd.d2} hasSprint={race.hasSprint} />
                          <div>
                            <p className="text-gray-500 text-xs mb-0.5">Écurie</p>
                            <p className="text-white text-xs">
                              {fmt(bd.teamPts)} pts
                              {race.hasSprint && bd.sprintTeamPts > 0 && ` + ${fmt(bd.sprintTeamPts)} sprint`}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-500 text-xs mb-0.5">Bonus</p>
                            <p className="text-white text-xs">
                              {bd.bonusPts > 0 ? `+${bd.bonusPts} pts` : "—"}
                            </p>
                          </div>
                        </div>
                        {bd.strategyNote && (
                          <p className="text-yellow-300 text-xs mb-1">{bd.strategyNote}</p>
                        )}
                        {bd.superDurPts > 0 && (
                          <p className="text-orange-300 text-xs mb-1">Super Dur : +{bd.superDurPts} pts</p>
                        )}
                        {bd.drsGain > 0 && (
                          <p className="text-green-300 text-xs mb-1">DRS : +{fmt(bd.drsGain)} pts</p>
                        )}
                        {bd.undercutLoss < 0 && (
                          <p className="text-red-300 text-xs mb-1">Undercut : {fmt(bd.undercutLoss)} pts</p>
                        )}
                        <div className="flex justify-between items-center border-t border-gray-700 pt-2 mt-1">
                          <span className="text-gray-400 text-xs">Total calculé</span>
                          <span className="text-white font-bold text-sm">{bd.total} pts</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
