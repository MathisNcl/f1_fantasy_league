"use client";

import React, { useState } from "react";
import { Race, Pick, Score } from "@prisma/client";
import { DRIVERS, STRATEGIES } from "@/lib/constants";
import { ScoreBreakdown } from "@/lib/scoring";

type PickWithRaceAndScore = Pick & {
  race: Race;
  score: Score | null;
};

type Props = {
  picks: PickWithRaceAndScore[];
};

function driverName(code: string) {
  return DRIVERS.find((d) => d.code === code)?.name ?? code;
}

function strategyLabel(code: string) {
  return STRATEGIES.find((s) => s.code === code)?.label ?? code;
}

function parseBreakdown(raw: string | null | undefined): ScoreBreakdown | null {
  if (!raw) return null;
  try { return JSON.parse(raw) as ScoreBreakdown; } catch { return null; }
}

function fmt(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}

function bonusLabel(pts: number): string {
  if (pts === 25) return "Pilote 1 devant (+5) + double podium P1+P2 (+20)";
  if (pts === 20) return "Double podium P1+P2, pilote 2 en tête (+20)";
  if (pts === 5)  return "Pilote 1 devant pilote 2 (+5)";
  return "—";
}

// ─── Encart de détail (affiché sous la ligne) ────────────────────────────────

function BreakdownPanel({ bd, hasSprint, pick }: {
  bd: ScoreBreakdown;
  hasSprint: boolean;
  pick: PickWithRaceAndScore;
}) {
  const renderDriverCard = (d: ScoreBreakdown["d1"], label: string) => {
    const energyPct = Math.round(d.energy * 100);
    const hasReducedEnergy = d.energy < 1.0;
    const hasSprintPts = hasSprint && (d.sprintQualiPts > 0 || d.sprintRacePts > 0);
    const posGain = d.posGain ?? 0;
    const posGainPts = d.posGainPts ?? 0;
    const posLost = d.posLost ?? false;
    const hasDnf = d.hasDnf ?? false;
    const hasFl = d.hasFastestLap ?? false;

    return (
      <div className="bg-gray-900 rounded-lg p-3 space-y-2">
        <p className="text-gray-500 text-xs uppercase tracking-wide">{label}</p>
        <p className="text-white font-semibold">{driverName(d.code)}</p>

        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-400">Qualifications</span>
            <span className="text-white">{fmt(d.qualiPts)} pts</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Course principale</span>
            <span className="text-white">{fmt(d.racePts)} pts</span>
          </div>
          {hasDnf && (
            <div className="flex justify-between pl-2">
              <span className="text-red-400">↳ Abandon</span>
              <span className="text-red-400">−5 pts</span>
            </div>
          )}
          {hasFl && (
            <div className="flex justify-between pl-2">
              <span className="text-purple-400">↳ Meilleur tour</span>
              <span className="text-purple-400">+2 pts</span>
            </div>
          )}
          {posGain > 0 && (
            <div className="flex justify-between pl-2">
              <span className="text-green-400">↳ +{posGain} place{posGain > 1 ? "s" : ""} remontée{posGain > 1 ? "s" : ""}</span>
              <span className="text-green-400">+{posGainPts} pts</span>
            </div>
          )}
          {posLost && (
            <div className="flex justify-between pl-2">
              <span className="text-orange-400">↳ Perte de positions</span>
              <span className="text-orange-400">−2 pts</span>
            </div>
          )}
          {(d.tailPenalty ?? 0) < 0 && (
            <div className="flex justify-between pl-2">
              <span className="text-red-400">↳ Queue de peloton</span>
              <span className="text-red-400">{d.tailPenalty} pts</span>
            </div>
          )}
          {hasSprintPts && (
            <>
              <div className="flex justify-between">
                <span className="text-gray-400">Sprint qualifying</span>
                <span className="text-white">{fmt(d.sprintQualiPts)} pts</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Course sprint</span>
                <span className="text-white">{fmt(d.sprintRacePts)} pts</span>
              </div>
            </>
          )}

          <div className="flex justify-between border-t border-gray-700 pt-1.5 mt-1">
            <span className="text-gray-400">Total brut</span>
            <span className="text-gray-200">{fmt(d.rawContrib)} pts</span>
          </div>
          <div className="flex justify-between">
            <span className={hasReducedEnergy ? "text-yellow-400" : "text-gray-400"}>
              ⚡ Énergie {energyPct}%
            </span>
            <span className={hasReducedEnergy ? "text-yellow-300 font-semibold" : "text-white"}>
              → {fmt(d.finalContrib)} pts
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 space-y-4">
      {/* Pilotes */}
      <div className="grid grid-cols-2 gap-3">
        {renderDriverCard(bd.d1, "Pilote 1")}
        {renderDriverCard(bd.d2, "Pilote 2")}
      </div>

      {/* Écurie + Bonus */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-900 rounded-lg p-3 text-xs space-y-1.5">
          <p className="text-gray-500 uppercase tracking-wide mb-1">Écurie — {pick.team}</p>
          <div className="flex justify-between">
            <span className="text-gray-400">Course principale</span>
            <span className="text-white">{fmt(bd.teamPts)} pts</span>
          </div>
          {hasSprint && bd.sprintTeamPts > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-400">Sprint</span>
              <span className="text-white">{fmt(bd.sprintTeamPts)} pts</span>
            </div>
          )}
          <div className="flex justify-between border-t border-gray-700 pt-1.5">
            <span className="text-gray-400">Total écurie</span>
            <span className="text-white font-medium">{fmt(bd.teamPts + bd.sprintTeamPts)} pts</span>
          </div>
        </div>

        <div className="bg-gray-900 rounded-lg p-3 text-xs space-y-1.5">
          <p className="text-gray-500 uppercase tracking-wide mb-1">Bonus pilotes</p>
          <p className="text-gray-300 leading-relaxed">{bonusLabel(bd.bonusPts)}</p>
          <p className={`font-semibold ${bd.bonusPts > 0 ? "text-green-400" : "text-gray-500"}`}>
            {bd.bonusPts > 0 ? `+${bd.bonusPts} pts` : "0 pt"}
          </p>
        </div>
      </div>

      {/* Effets de stratégie */}
      {(bd.strategyNote || bd.superDurPts > 0 || bd.pluieActivated || bd.drsGain > 0 || bd.undercutLoss < 0 || bd.fiaCancelled) && (
        <div className="bg-gray-900 rounded-lg p-3 text-xs space-y-1.5">
          <p className="text-gray-500 uppercase tracking-wide mb-1">
            Stratégie — {strategyLabel(pick.strategy)}
          </p>
          {bd.fiaCancelled && (
            <p className="text-red-400">FIA activé — toutes les stratégies annulées</p>
          )}
          {bd.strategyNote && !bd.fiaCancelled && (
            <p className="text-yellow-300">{bd.strategyNote}</p>
          )}
          {bd.superDurPts > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-400">Super Dur</span>
              <span className="text-orange-400 font-semibold">+{bd.superDurPts} pts</span>
            </div>
          )}
          {bd.pluieActivated && (
            <div className="flex justify-between">
              <span className="text-gray-400">Pluie (drapeau rouge)</span>
              <span className="text-blue-400 font-semibold">Total ×2</span>
            </div>
          )}
          {bd.drsGain > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-400">DRS — gain sur la cible</span>
              <span className="text-green-400 font-semibold">+{fmt(bd.drsGain)} pts</span>
            </div>
          )}
          {bd.undercutLoss < 0 && (
            <div className="flex justify-between">
              <span className="text-gray-400">Undercut reçu</span>
              <span className="text-red-400 font-semibold">{fmt(bd.undercutLoss)} pts</span>
            </div>
          )}
        </div>
      )}

      {/* Total */}
      <div className="flex items-center justify-between border-t border-gray-700 pt-3">
        <span className="text-gray-300 font-medium text-sm">Score final</span>
        <span className="text-white font-bold text-xl">{bd.total} pts</span>
      </div>
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function MyPicksHistory({ picks }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const pastPicks = picks.filter((p) => new Date(p.race.date) < new Date());

  const toggle = (id: string, hasBd: boolean) => {
    if (!hasBd) return;
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
      <h2 className="text-xl font-semibold text-white mb-4">
        Historique de mes picks
      </h2>

      {pastPicks.length === 0 ? (
        <p className="text-gray-400 text-sm">
          Aucun pick enregistré pour les courses passées.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-800">
                <th className="text-left pb-3 font-medium">Grand Prix</th>
                <th className="text-left pb-3 font-medium">Pilote 1</th>
                <th className="text-left pb-3 font-medium">Pilote 2</th>
                <th className="text-left pb-3 font-medium">Écurie</th>
                <th className="text-left pb-3 font-medium">Stratégie</th>
                <th className="text-right pb-3 font-medium">Points</th>
              </tr>
            </thead>
            <tbody>
              {pastPicks.map((pick) => {
                const bd = parseBreakdown(pick.score?.breakdown);
                const isExpanded = expandedId === pick.id;
                const hasBd = bd !== null;

                return (
                  <React.Fragment key={pick.id}>
                    <tr
                      onClick={() => toggle(pick.id, hasBd)}
                      className={`border-b border-gray-800 transition-colors ${
                        hasBd
                          ? "cursor-pointer hover:bg-gray-800/50"
                          : "cursor-default"
                      } ${isExpanded ? "bg-gray-800/30" : ""}`}
                    >
                      {/* GP */}
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <p className="text-white font-medium">{pick.race.name}</p>
                          {pick.race.hasSprint && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-purple-900 text-purple-300 border border-purple-700">
                              S
                            </span>
                          )}
                          {hasBd && (
                            <span className={`text-gray-500 text-xs transition-transform duration-200 ${isExpanded ? "rotate-180 inline-block" : ""}`}>
                              ▾
                            </span>
                          )}
                        </div>
                        <p className="text-gray-500 text-xs">
                          {new Date(pick.race.date).toLocaleDateString("fr-FR")}
                        </p>
                      </td>

                      <td className="py-3 pr-4 text-gray-300">
                        {driverName(pick.driver1)}
                      </td>
                      <td className="py-3 pr-4 text-gray-300">
                        {driverName(pick.driver2)}
                      </td>
                      <td className="py-3 pr-4 text-gray-300">{pick.team}</td>
                      <td className="py-3 pr-4 text-gray-300 text-xs">
                        {strategyLabel(pick.strategy)}
                      </td>

                      {/* Score */}
                      <td className="py-3 text-right">
                        {pick.score ? (
                          <span className="text-white font-bold text-base">
                            {pick.score.points} pts
                          </span>
                        ) : (
                          <span className="text-gray-500 text-xs">En attente</span>
                        )}
                      </td>
                    </tr>

                    {/* Encart de détail */}
                    {isExpanded && bd && (
                      <tr key={`${pick.id}-detail`} className="border-b border-gray-800">
                        <td colSpan={6} className="p-0">
                          <div className="bg-gray-800/40 border-l-2 border-red-800 mx-0">
                            <BreakdownPanel bd={bd} hasSprint={pick.race.hasSprint} pick={pick} />
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
