"use client";

import { useState } from "react";
import { DRIVERS, STRATEGIES } from "@/lib/constants";
import type { ScoreBreakdown } from "@/lib/scoring";

export type RaceHistoryEntry = {
  raceId: number;
  raceName: string;
  raceDate: string;
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

export default function UserRaceHistory({ races }: { races: RaceHistoryEntry[] }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  function toggle(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (races.length === 0) {
    return (
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-2">Historique des courses</h2>
        <p className="text-gray-400 text-sm">Aucun résultat disponible pour le moment.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
      <h2 className="text-lg font-semibold text-white mb-4">Historique des courses</h2>
      <div className="space-y-2">
        {races.map((r) => {
          const isOpen = expanded.has(r.raceId);
          const bd = r.breakdown ? (JSON.parse(r.breakdown) as ScoreBreakdown) : null;
          const strat = STRATEGIES.find((s) => s.code === r.strategy);
          const d1 = DRIVERS.find((d) => d.code === r.driver1);
          const d2 = DRIVERS.find((d) => d.code === r.driver2);

          return (
            <div key={r.raceId} className="rounded-lg border border-gray-800 overflow-hidden">
              {/* Summary row */}
              <button
                onClick={() => toggle(r.raceId)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-800 hover:bg-gray-700 transition-colors text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-gray-500 text-xs shrink-0">
                    {new Date(r.raceDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                  </span>
                  <span className="text-white font-medium text-sm truncate">{r.raceName}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-3">
                  {strat && (
                    <span className="text-xs text-gray-400 hidden sm:block">{strat.label}</span>
                  )}
                  <span className="text-white font-bold text-sm">
                    {r.score !== null ? `${r.score} pts` : "—"}
                  </span>
                  <span className="text-gray-500 text-xs">{isOpen ? "▲" : "▼"}</span>
                </div>
              </button>

              {/* Expandable detail */}
              {isOpen && (
                <div className="px-4 py-4 bg-gray-900 space-y-4 border-t border-gray-800">
                  {/* Picks summary */}
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <div className="text-gray-400 text-xs mb-1">Pilote 1</div>
                      <div className="text-white font-medium">{d1?.name ?? r.driver1}</div>
                    </div>
                    <div>
                      <div className="text-gray-400 text-xs mb-1">Pilote 2</div>
                      <div className="text-white font-medium">{d2?.name ?? r.driver2}</div>
                    </div>
                    <div>
                      <div className="text-gray-400 text-xs mb-1">Écurie</div>
                      <div className="text-white font-medium">{r.team}</div>
                    </div>
                  </div>

                  {strat && (
                    <div className="text-xs text-gray-400">
                      Stratégie : <span className="text-white">{strat.label}</span>
                      {r.drsTargetName && (
                        <span className="text-gray-400"> → cible : <span className="text-green-400">{r.drsTargetName}</span></span>
                      )}
                      {r.huileMoteurTarget && (
                        <span className="text-gray-400"> → boost : <span className="text-cyan-400">{r.huileMoteurTarget}</span></span>
                      )}
                    </div>
                  )}

                  {bd ? (
                    <div className="space-y-2">
                      {/* Driver breakdowns */}
                      {[bd.d1, bd.d2].map((d) => (
                        <div key={d.code} className="rounded-lg bg-gray-800 p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-white font-medium text-sm">
                              {DRIVERS.find((dr) => dr.code === d.code)?.name ?? d.code}
                              {d.energy < 1.0 && (
                                <span className={`ml-2 text-xs ${d.energy >= 0.7 ? "text-yellow-400" : d.energy >= 0.5 ? "text-orange-400" : "text-red-400"}`}>
                                  {Math.round(d.energy * 100)}% énergie
                                </span>
                              )}
                            </span>
                            <span className="text-white font-bold text-sm">{Math.round(d.finalContrib)} pts</span>
                          </div>
                          <div className="space-y-1 text-xs">
                            {d.qualiPts > 0 && (
                              <div className="flex justify-between text-gray-300">
                                <span>Qualifications{d.qualiPos ? ` (P${d.qualiPos})` : ""}</span>
                                <span>+{d.qualiPts}</span>
                              </div>
                            )}
                            {d.racePts !== 0 && (
                              <div className="flex justify-between text-gray-300">
                                <span>Course{d.raceFinishPos ? ` (P${d.raceFinishPos})` : ""}</span>
                                <span className={d.racePts < 0 ? "text-red-400" : ""}>{d.racePts > 0 ? "+" : ""}{Math.round(d.racePts)}</span>
                              </div>
                            )}
                            {d.hasDnf && (
                              <div className="flex justify-between text-red-400 pl-2">
                                <span>↳ Abandon</span>
                                <span>−5</span>
                              </div>
                            )}
                            {d.hasFastestLap && (
                              <div className="flex justify-between text-purple-400 pl-2">
                                <span>↳ Meilleur tour</span>
                                <span>+2</span>
                              </div>
                            )}
                            {d.posGain > 0 && (
                              <div className="flex justify-between text-green-400 pl-2">
                                <span>↳ +{d.posGain} place{d.posGain > 1 ? "s" : ""} remontée{d.posGain > 1 ? "s" : ""}</span>
                                <span>+{d.posGainPts}</span>
                              </div>
                            )}
                            {d.posLost && (
                              <div className="flex justify-between text-orange-400 pl-2">
                                <span>↳ Perte de positions</span>
                                <span>−2</span>
                              </div>
                            )}
                            {(d.tailPenalty ?? 0) < 0 && (
                              <div className="flex justify-between text-red-400 pl-2">
                                <span>↳ Queue de peloton</span>
                                <span>{d.tailPenalty}</span>
                              </div>
                            )}
                            {d.sprintQualiPts > 0 && (
                              <div className="flex justify-between text-gray-300">
                                <span>Sprint quali</span>
                                <span>+{d.sprintQualiPts}</span>
                              </div>
                            )}
                            {d.sprintRacePts > 0 && (
                              <div className="flex justify-between text-gray-300">
                                <span>Sprint course</span>
                                <span>+{d.sprintRacePts}</span>
                              </div>
                            )}
                            {d.energy < 1.0 && d.rawContrib !== d.finalContrib && (
                              <div className="flex justify-between text-gray-500 mt-1 pt-1 border-t border-gray-700">
                                <span>Après énergie ×{Math.round(d.energy * 100)}%</span>
                                <span>{Math.round(d.rawContrib)} → {Math.round(d.finalContrib)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}

                      {/* Team + bonuses */}
                      <div className="rounded-lg bg-gray-800 p-3 space-y-1 text-xs">
                        {bd.teamPts > 0 && (
                          <div className="flex justify-between text-gray-300">
                            <span>Écurie ({r.team})</span>
                            <span>+{Math.round(bd.teamPts)}</span>
                          </div>
                        )}
                        {bd.sprintTeamPts > 0 && (
                          <div className="flex justify-between text-gray-300">
                            <span>Écurie (sprint)</span>
                            <span>+{Math.round(bd.sprintTeamPts)}</span>
                          </div>
                        )}
                        {bd.bonusPts > 0 && (
                          <div className="flex justify-between text-yellow-400">
                            <span>Bonus</span>
                            <span>+{bd.bonusPts}</span>
                          </div>
                        )}
                        {bd.superDurPts > 0 && (
                          <div className="flex justify-between text-orange-400">
                            <span>Super Dur</span>
                            <span>+{bd.superDurPts}</span>
                          </div>
                        )}
                        {bd.drsGain > 0 && (
                          <div className="flex justify-between text-green-400">
                            <span>DRS</span>
                            <span>+{Math.round(bd.drsGain)}</span>
                          </div>
                        )}
                        {bd.undercutLoss < 0 && (
                          <div className="flex justify-between text-red-400">
                            <span>Undercut (pénalité)</span>
                            <span>{Math.round(bd.undercutLoss)}</span>
                          </div>
                        )}
                        {bd.pluieActivated && (
                          <div className="flex justify-between text-blue-400">
                            <span>Pluie ×2</span>
                            <span>activé</span>
                          </div>
                        )}
                        {bd.fiaCancelled && (
                          <div className="text-gray-500 text-xs">FIA : stratégies annulées</div>
                        )}
                        <div className="flex justify-between text-white font-bold mt-2 pt-2 border-t border-gray-600">
                          <span>Total</span>
                          <span>{r.score !== null ? r.score : Math.round(bd.total)} pts</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-500 text-xs">Résultats pas encore enregistrés.</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
