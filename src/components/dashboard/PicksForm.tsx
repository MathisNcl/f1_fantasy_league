"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Race, Pick } from "@prisma/client";
import { TEAMS, STRATEGIES, DRIVERS } from "@/lib/constants";
import { getPicksOpenDate, getPicksDeadline, formatPicksDate } from "@/lib/dates";
import DriverSelect from "./DriverSelect";

type OtherUser = { id: string; name: string };

type Props = {
  race: Race;
  existingPick: Pick | null;
  energyMap: Record<string, number>;
  remainingTokens: Record<string, number>;
  otherUsers: OtherUser[];
};

const STRATEGY_COLORS: Record<string, string> = {
  red: "bg-red-900 text-red-300 border-red-700",
  yellow: "bg-yellow-900 text-yellow-300 border-yellow-700",
  gray: "bg-gray-800 text-gray-300 border-gray-600",
  white: "bg-gray-700 text-white border-gray-500",
  orange: "bg-orange-900 text-orange-300 border-orange-700",
  blue: "bg-blue-900 text-blue-300 border-blue-700",
  purple: "bg-purple-900 text-purple-300 border-purple-700",
  green: "bg-green-900 text-green-300 border-green-700",
  cyan: "bg-cyan-900 text-cyan-300 border-cyan-700",
};

export default function PicksForm({
  race,
  existingPick,
  energyMap,
  remainingTokens,
  otherUsers,
}: Props) {
  const router = useRouter();
  const [driver1, setDriver1] = useState(existingPick?.driver1 ?? "");
  const [driver2, setDriver2] = useState(existingPick?.driver2 ?? "");
  const [team, setTeam] = useState(existingPick?.team ?? "");
  const [strategy, setStrategy] = useState(existingPick?.strategy ?? "");
  const [drsTarget, setDrsTarget] = useState(existingPick?.drsTarget ?? "");
  const [huileMoteurTarget, setHuileMoteurTarget] = useState(
    (existingPick as (Pick & { huileMoteurTarget?: string | null }) | null)?.huileMoteurTarget ?? ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const raceDate = new Date(race.date);
  const customDeadline = (race as Race & { deadline?: string | null }).deadline;
  const openDate = getPicksOpenDate(raceDate);
  const deadline = getPicksDeadline(raceDate, customDeadline ? new Date(customDeadline) : null);

  const now = Date.now();
  const isNotOpen = now < openDate.getTime();
  const isClosed = now >= deadline.getTime();
  const isOpen = !isNotOpen && !isClosed;

  const hoursUntilOpen = Math.ceil((openDate.getTime() - now) / (1000 * 60 * 60));
  const daysUntilDeadline = Math.ceil((deadline.getTime() - now) / (1000 * 60 * 60 * 24));

  function handleStrategyChange(code: string) {
    setStrategy(code);
    // Reset strategy-specific targets when strategy changes
    if (code !== "drs") setDrsTarget("");
    if (code !== "huile_moteur") setHuileMoteurTarget("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (driver1 === driver2) {
      setError("Vous devez choisir deux pilotes différents.");
      return;
    }
    if (strategy === "drs" && !drsTarget) {
      setError("Choisissez une cible pour la stratégie DRS.");
      return;
    }
    if (strategy === "huile_moteur" && !huileMoteurTarget) {
      setError("Choisissez un pilote cible pour la stratégie Huile moteur.");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/picks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        raceId: race.id,
        driver1,
        driver2,
        team,
        strategy,
        drsTarget: strategy === "drs" ? drsTarget : null,
        huileMoteurTarget: strategy === "huile_moteur" ? huileMoteurTarget : null,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Une erreur est survenue.");
      return;
    }

    setSuccess(true);
    router.refresh();
  }

  const selectClass =
    "w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-colors";

  // Options for huile_moteur target: the 2 selected drivers
  const huileMoteurOptions = [driver1, driver2].filter(Boolean).map((code) => {
    const d = DRIVERS.find((dr) => dr.code === code);
    return { code, label: d ? `${d.name} (${d.code})` : code };
  });

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
      {/* En-tête */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-white">Prochain Grand Prix</h2>
            {race.hasSprint && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-purple-900 text-purple-300 border border-purple-700">
                SPRINT
              </span>
            )}
          </div>
          <p className="text-red-400 font-medium mt-0.5">{race.name}</p>
        </div>
        <div className="text-right">
          <p className="text-gray-400 text-sm">{race.location}</p>
          <p className="text-gray-500 text-xs mt-0.5">
            {raceDate.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
          </p>
          {isNotOpen && (
            <p className="text-blue-400 text-xs font-medium mt-1">
              {hoursUntilOpen <= 24
                ? `Ouverture dans ${hoursUntilOpen}h`
                : `Ouverture dans ${Math.ceil(hoursUntilOpen / 24)}j`}
            </p>
          )}
          {isOpen && (
            <p
              className={`text-xs font-medium mt-1 ${
                daysUntilDeadline <= 1 ? "text-orange-400" : "text-green-400"
              }`}
            >
              {daysUntilDeadline <= 0
                ? "Ferme bientôt"
                : `Ferme dans ${daysUntilDeadline}j`}
            </p>
          )}
          {isClosed && (
            <p className="text-red-400 text-xs font-medium mt-1">Deadline passée</p>
          )}
        </div>
      </div>

      {/* Bandeau : pas encore ouvert */}
      {isNotOpen && (
        <div className="bg-blue-950 border border-blue-800 rounded-lg px-4 py-3 mb-4">
          <p className="text-blue-300 text-sm font-medium">
            Formulaire fermé pour l&apos;instant
          </p>
          <p className="text-blue-400 text-xs mt-0.5">
            Ouverture le {formatPicksDate(openDate)}
          </p>
        </div>
      )}

      {/* Bandeau : deadline passée */}
      {isClosed && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 mb-4">
          <p className="text-gray-400 text-sm font-medium">
            Deadline passée — {formatPicksDate(deadline)}
          </p>
          {existingPick && (
            <p className="text-gray-500 text-xs mt-0.5">Vos picks ont bien été enregistrés.</p>
          )}
        </div>
      )}

      {/* Bandeau : picks déjà soumis */}
      {isOpen && existingPick && (
        <div className="bg-green-950 border border-green-800 rounded-lg px-4 py-2.5 mb-4">
          <p className="text-green-400 text-sm font-medium">
            Picks soumis — modifiables jusqu&apos;au {formatPicksDate(deadline)}
          </p>
        </div>
      )}

      {/* Bandeau sprint */}
      {race.hasSprint && (
        <div className="bg-purple-950 border border-purple-800 rounded-lg px-4 py-2.5 mb-4">
          <p className="text-purple-300 text-sm">
            Week-end Sprint — sprint quali + course sprint inclus dans le score.
          </p>
        </div>
      )}

      {/* Formulaire (masqué si fermé) */}
      {!isClosed && (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Pilote 1 */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Pilote 1
            </label>
            <DriverSelect
              value={driver1}
              onChange={setDriver1}
              energyMap={energyMap}
              excludeCode={driver2}
              disabled={isNotOpen}
              placeholder="Choisir un pilote..."
            />
          </div>

          {/* Pilote 2 */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Pilote 2
            </label>
            <DriverSelect
              value={driver2}
              onChange={setDriver2}
              energyMap={energyMap}
              excludeCode={driver1}
              disabled={isNotOpen}
              placeholder="Choisir un pilote..."
            />
          </div>

          {/* Écurie */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Écurie
            </label>
            <select
              value={team}
              onChange={(e) => setTeam(e.target.value)}
              required
              disabled={isNotOpen}
              className={`${selectClass} disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <option value="">Choisir une écurie...</option>
              {TEAMS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Stratégie */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Stratégie
            </label>
            <div className={`grid grid-cols-1 gap-2 ${isNotOpen ? "opacity-50 pointer-events-none" : ""}`}>
              {STRATEGIES.map((s) => {
                const tokens = remainingTokens[s.code] ?? 0;
                const isExisting = existingPick?.strategy === s.code;
                const available = isExisting ? true : tokens > 0;
                const colorClass = STRATEGY_COLORS[s.color] ?? STRATEGY_COLORS.gray;
                const isSelected = strategy === s.code;

                return (
                  <label
                    key={s.code}
                    className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-all ${
                      !available
                        ? "opacity-40 cursor-not-allowed border-gray-700 bg-gray-800/40"
                        : isSelected
                        ? `${colorClass} ring-2 ring-offset-1 ring-offset-gray-900 ring-white/30`
                        : "border-gray-700 bg-gray-800/60 hover:border-gray-500"
                    }`}
                  >
                    <input
                      type="radio"
                      name="strategy"
                      value={s.code}
                      checked={isSelected}
                      onChange={() => handleStrategyChange(s.code)}
                      disabled={!available}
                      className="sr-only"
                      required
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white">{s.label}</span>
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                            tokens === 0 && !isExisting
                              ? "bg-red-900 text-red-400"
                              : "bg-gray-700 text-gray-300"
                          }`}
                        >
                          {tokens}/{s.tokens}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{s.description}</p>
                    </div>
                    {isSelected && (
                      <span className="text-white text-xs font-bold shrink-0">✓</span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Cible DRS */}
          {strategy === "drs" && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Cible DRS (joueur)
              </label>
              {otherUsers.length === 0 ? (
                <p className="text-gray-500 text-sm">Aucun autre joueur disponible.</p>
              ) : (
                <select
                  value={drsTarget}
                  onChange={(e) => setDrsTarget(e.target.value)}
                  required
                  disabled={isNotOpen}
                  className={`${selectClass} disabled:opacity-50`}
                >
                  <option value="">Choisir un joueur...</option>
                  {otherUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Cible Huile moteur */}
          {strategy === "huile_moteur" && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Pilote boosté (Huile moteur)
              </label>
              {!driver1 || !driver2 ? (
                <p className="text-gray-500 text-sm">Sélectionnez vos 2 pilotes d&apos;abord.</p>
              ) : (
                <select
                  value={huileMoteurTarget}
                  onChange={(e) => setHuileMoteurTarget(e.target.value)}
                  required
                  disabled={isNotOpen}
                  className={`${selectClass} disabled:opacity-50`}
                >
                  <option value="">Choisir un pilote à booster...</option>
                  {huileMoteurOptions.map((opt) => (
                    <option key={opt.code} value={opt.code}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {error && (
            <p className="text-red-400 text-sm bg-red-950 border border-red-800 rounded-lg px-4 py-3">
              {error}
            </p>
          )}

          {success && (
            <p className="text-green-400 text-sm bg-green-950 border border-green-800 rounded-lg px-4 py-3">
              Picks enregistrés avec succès !
            </p>
          )}

          <button
            type="submit"
            disabled={loading || isNotOpen}
            className="w-full bg-red-600 hover:bg-red-500 disabled:bg-red-900 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors"
          >
            {loading
              ? "Enregistrement..."
              : isNotOpen
              ? "Formulaire pas encore ouvert"
              : existingPick
              ? "Modifier mes picks"
              : "Valider mes picks"}
          </button>
        </form>
      )}
    </div>
  );
}
