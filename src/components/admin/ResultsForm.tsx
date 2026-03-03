"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Race, RaceResult } from "@prisma/client";
import { DRIVERS } from "@/lib/constants";
import { DriverResultData } from "@/lib/scoring";

type RaceWithResult = Race & { result: RaceResult | null };

type Props = {
  races: RaceWithResult[];
};

type DriverRow = {
  driverCode: string;
  // Course principale
  qualifyingPos: string;
  racePos: string;
  isDnf: boolean;
  // Sprint
  sprintQualiPos: string;
  sprintRacePos: string;
  sprintIsDnf: boolean;
};

function initRows(): DriverRow[] {
  return DRIVERS.map((d) => ({
    driverCode: d.code,
    qualifyingPos: "",
    racePos: "",
    isDnf: false,
    sprintQualiPos: "",
    sprintRacePos: "",
    sprintIsDnf: false,
  }));
}

export default function ResultsForm({ races }: Props) {
  const router = useRouter();
  const [raceId, setRaceId] = useState("");
  const [fastestLap, setFastestLap] = useState("");
  const [hasRedFlag, setHasRedFlag] = useState(false);
  const [hasSprintRedFlag, setHasSprintRedFlag] = useState(false);
  const [rows, setRows] = useState<DriverRow[]>(initRows);
  const [activeTab, setActiveTab] = useState<"sprint" | "course">("sprint");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const pastRaces = races.filter((r) => new Date(r.date) < new Date());
  const selectedRace = pastRaces.find((r) => r.id === Number(raceId));
  const hasSprint = selectedRace?.hasSprint ?? false;

  function updateRow(code: string, field: keyof DriverRow, value: string | boolean) {
    setRows((prev) =>
      prev.map((r) => (r.driverCode === code ? { ...r, [field]: value } : r))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    const driverResults: DriverResultData[] = rows.map((row) => ({
      driverCode: row.driverCode,
      qualifyingPos: row.qualifyingPos ? Number(row.qualifyingPos) : null,
      racePos: row.isDnf ? null : row.racePos ? Number(row.racePos) : null,
      isDnf: row.isDnf,
      sprintQualiPos: row.sprintQualiPos ? Number(row.sprintQualiPos) : null,
      sprintRacePos: row.sprintIsDnf ? null : row.sprintRacePos ? Number(row.sprintRacePos) : null,
      sprintIsDnf: row.sprintIsDnf,
    }));

    const res = await fetch("/api/results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        raceId: Number(raceId),
        fastestLap,
        hasRedFlag,
        hasSprintRedFlag,
        driverResults,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setMessage({ type: "error", text: data.error ?? "Erreur lors de la sauvegarde." });
      return;
    }

    const data = await res.json();
    setMessage({
      type: "success",
      text: `Résultats enregistrés. ${data.scoresCalculated} scores calculés.`,
    });
    router.refresh();
  }

  const inputClass =
    "w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-yellow-500 text-center";

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
      <h2 className="text-xl font-semibold text-white mb-4">
        Saisir un résultat de course
      </h2>

      {pastRaces.length === 0 ? (
        <p className="text-gray-400 text-sm">Aucune course passée.</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Sélection du GP */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Grand Prix
            </label>
            <select
              value={raceId}
              onChange={(e) => {
                setRaceId(e.target.value);
                setRows(initRows());
                setActiveTab("sprint");
              }}
              required
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-yellow-500 text-sm"
            >
              <option value="">Sélectionner un GP...</option>
              {pastRaces.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}{r.hasSprint ? " 🏎 Sprint" : ""} {r.result ? "✓" : ""}
                </option>
              ))}
            </select>
          </div>

          {raceId && (
            <>
              {/* Onglets Sprint / Course (si week-end sprint) */}
              {hasSprint && (
                <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab("sprint")}
                    className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                      activeTab === "sprint"
                        ? "bg-purple-700 text-white"
                        : "text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    Sprint
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("course")}
                    className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                      activeTab === "course"
                        ? "bg-yellow-700 text-white"
                        : "text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    Course principale
                  </button>
                </div>
              )}

              {/* Section Sprint */}
              {hasSprint && activeTab === "sprint" && (
                <div className="space-y-4">
                  {/* Drapeau rouge sprint */}
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hasSprintRedFlag}
                        onChange={(e) => setHasSprintRedFlag(e.target.checked)}
                        className="w-4 h-4 accent-red-500"
                      />
                      <span className="text-sm text-gray-300">Drapeau rouge (sprint)</span>
                    </label>
                  </div>

                  {/* Tableau sprint */}
                  <div>
                    <p className="text-sm font-medium text-gray-300 mb-2">
                      Résultats Sprint
                    </p>
                    <div className="overflow-x-auto rounded-lg border border-purple-800/50">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-purple-950/60 text-gray-400">
                            <th className="text-left px-3 py-2 font-medium">Pilote</th>
                            <th className="px-2 py-2 font-medium w-16">SQ</th>
                            <th className="px-2 py-2 font-medium w-16">Arrivée</th>
                            <th className="px-2 py-2 font-medium w-12">DNF</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                          {rows.map((row) => {
                            const driver = DRIVERS.find((d) => d.code === row.driverCode)!;
                            return (
                              <tr
                                key={row.driverCode}
                                className={`${
                                  row.sprintIsDnf ? "bg-red-950/20" : "hover:bg-gray-800/40"
                                } transition-colors`}
                              >
                                <td className="px-3 py-1.5">
                                  <span className="font-mono font-bold text-gray-200">
                                    {row.driverCode}
                                  </span>
                                  <span className="text-gray-500 ml-1.5">{driver.team}</span>
                                </td>
                                <td className="px-2 py-1.5">
                                  <input
                                    type="number"
                                    min="1"
                                    max="20"
                                    value={row.sprintQualiPos}
                                    onChange={(e) =>
                                      updateRow(row.driverCode, "sprintQualiPos", e.target.value)
                                    }
                                    placeholder="—"
                                    className={inputClass}
                                  />
                                </td>
                                <td className="px-2 py-1.5">
                                  <input
                                    type="number"
                                    min="1"
                                    max="20"
                                    value={row.sprintRacePos}
                                    onChange={(e) =>
                                      updateRow(row.driverCode, "sprintRacePos", e.target.value)
                                    }
                                    disabled={row.sprintIsDnf}
                                    placeholder={row.sprintIsDnf ? "DNF" : "—"}
                                    className={`${inputClass} disabled:opacity-40`}
                                  />
                                </td>
                                <td className="px-2 py-1.5 text-center">
                                  <input
                                    type="checkbox"
                                    checked={row.sprintIsDnf}
                                    onChange={(e) => {
                                      updateRow(row.driverCode, "sprintIsDnf", e.target.checked);
                                      if (e.target.checked)
                                        updateRow(row.driverCode, "sprintRacePos", "");
                                    }}
                                    className="accent-red-500 w-4 h-4"
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-gray-600 text-xs mt-1.5">
                      SQ = position en Sprint Qualifying (= grille de départ sprint) · Arrivée = position de fin de sprint
                    </p>
                  </div>
                </div>
              )}

              {/* Section Course principale */}
              {(!hasSprint || activeTab === "course") && (
                <div className="space-y-4">
                  {/* Options globales */}
                  <div className="flex gap-6 items-end">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-300 mb-1.5">
                        Meilleur tour (pilote)
                      </label>
                      <select
                        value={fastestLap}
                        onChange={(e) => setFastestLap(e.target.value)}
                        required
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-yellow-500 text-sm"
                      >
                        <option value="">Choisir...</option>
                        {DRIVERS.map((d) => (
                          <option key={d.code} value={d.code}>
                            {d.code} — {d.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer pb-2">
                      <input
                        type="checkbox"
                        checked={hasRedFlag}
                        onChange={(e) => setHasRedFlag(e.target.checked)}
                        className="w-4 h-4 accent-red-500"
                      />
                      <span className="text-sm text-gray-300">Drapeau rouge</span>
                    </label>
                  </div>

                  {/* Tableau pilotes */}
                  <div>
                    <p className="text-sm font-medium text-gray-300 mb-2">
                      Résultats par pilote
                    </p>
                    <div className="overflow-x-auto rounded-lg border border-gray-700">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-gray-800 text-gray-400">
                            <th className="text-left px-3 py-2 font-medium">Pilote</th>
                            <th className="px-2 py-2 font-medium w-16">Quali</th>
                            <th className="px-2 py-2 font-medium w-16">Arrivée</th>
                            <th className="px-2 py-2 font-medium w-12">DNF</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                          {rows.map((row) => {
                            const driver = DRIVERS.find((d) => d.code === row.driverCode)!;
                            return (
                              <tr
                                key={row.driverCode}
                                className={`${
                                  row.isDnf ? "bg-red-950/20" : "hover:bg-gray-800/40"
                                } transition-colors`}
                              >
                                <td className="px-3 py-1.5">
                                  <span className="font-mono font-bold text-gray-200">
                                    {row.driverCode}
                                  </span>
                                  <span className="text-gray-500 ml-1.5">{driver.team}</span>
                                </td>
                                <td className="px-2 py-1.5">
                                  <input
                                    type="number"
                                    min="1"
                                    max="20"
                                    value={row.qualifyingPos}
                                    onChange={(e) =>
                                      updateRow(row.driverCode, "qualifyingPos", e.target.value)
                                    }
                                    placeholder="—"
                                    className={inputClass}
                                  />
                                </td>
                                <td className="px-2 py-1.5">
                                  <input
                                    type="number"
                                    min="1"
                                    max="20"
                                    value={row.racePos}
                                    onChange={(e) =>
                                      updateRow(row.driverCode, "racePos", e.target.value)
                                    }
                                    disabled={row.isDnf}
                                    placeholder={row.isDnf ? "DNF" : "—"}
                                    className={`${inputClass} disabled:opacity-40`}
                                  />
                                </td>
                                <td className="px-2 py-1.5 text-center">
                                  <input
                                    type="checkbox"
                                    checked={row.isDnf}
                                    onChange={(e) => {
                                      updateRow(row.driverCode, "isDnf", e.target.checked);
                                      if (e.target.checked)
                                        updateRow(row.driverCode, "racePos", "");
                                    }}
                                    className="accent-red-500 w-4 h-4"
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-gray-600 text-xs mt-1.5">
                      Quali = position en qualifications (= grille de départ) · Arrivée = position de fin de course
                    </p>
                  </div>
                </div>
              )}
            </>
          )}

          {message && (
            <p
              className={`text-sm rounded-lg px-4 py-3 border ${
                message.type === "success"
                  ? "text-green-400 bg-green-950 border-green-800"
                  : "text-red-400 bg-red-950 border-red-800"
              }`}
            >
              {message.text}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !raceId}
            className="w-full bg-yellow-600 hover:bg-yellow-500 disabled:bg-yellow-900 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors text-sm"
          >
            {loading ? "Calcul des scores..." : "Enregistrer et calculer les scores"}
          </button>
        </form>
      )}
    </div>
  );
}
