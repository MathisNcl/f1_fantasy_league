import { DRIVERS } from "./constants";

export type JolpicaDriverRow = {
  driverCode: string;
  qualifyingPos: string;
  racePos: string;
  isDnf: boolean;
  sprintQualiPos: string;
  sprintRacePos: string;
  sprintIsDnf: boolean;
};

export type JolpicaFetchResult =
  | { ok: true; rows: JolpicaDriverRow[]; fastestLap: string; mapped: number }
  | { ok: false; error: string };

const UA = { "User-Agent": "F1FantasyLeague/1.0 (+personal project)" };

// positionText numérique = a terminé (même doublé) ; "R", "W", "D"... = DNF/DNS
function isDnfByPositionText(positionText: string): boolean {
  return !/^\d+$/.test(positionText);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchErgastResults(url: string, key: string): Promise<any[]> {
  try {
    const res = await fetch(url, { cache: "no-store", headers: UA });
    if (!res.ok) return [];
    const data = await res.json();
    return data.MRData?.RaceTable?.Races?.[0]?.[key] ?? [];
  } catch {
    return [];
  }
}

/**
 * Récupère ce qui est disponible sur Jolpica-F1 pour un GP, SESSION PAR SESSION
 * (qualifs, sprint, course) de façon indépendante — pas d'échec global si la
 * course n'a pas encore eu lieu. Pensé pour être appelé plusieurs fois pendant
 * le week-end et voir les données se compléter progressivement :
 * - Qualifs disponibles dès le samedi (ou vendredi en format sprint).
 * - Sprint disponible une fois la course sprint courue (samedi, week-ends sprint).
 * - Course + grille définitive (post-pénalités) disponibles dès dimanche soir.
 *
 * Avant que la course n'ait eu lieu, qualifyingPos retombe sur le classement
 * brut des qualifs (`qualifying.json`) comme approximation provisoire de la
 * grille — c'est voulu, un score provisoire n'a pas besoin d'être exact. Une
 * fois la course disputée, c'est toujours `grid` (place de départ réelle,
 * après pénalités) qui prime, jamais le classement brut.
 *
 * Jolpica n'expose aucun endpoint dédié à la Sprint Qualifying/Shootout : le
 * classement sprint (sprintQualiPos) n'apparaît qu'une fois la course sprint
 * elle-même courue (son champ `grid`), pas avant.
 */
export async function fetchJolpicaResults(
  season: number,
  round: number,
  hasSprint: boolean
): Promise<JolpicaFetchResult> {
  const base = `https://api.jolpi.ca/ergast/f1/${season}/${round}`;

  const [qualiResults, sprintResults, raceResults] = await Promise.all([
    fetchErgastResults(`${base}/qualifying.json`, "QualifyingResults"),
    hasSprint ? fetchErgastResults(`${base}/sprint.json`, "SprintResults") : Promise.resolve([]),
    fetchErgastResults(`${base}/results.json`, "Results"),
  ]);

  const rows: JolpicaDriverRow[] = DRIVERS.map((d) => {
    const qualiResult = qualiResults.find((r) => r.Driver?.code === d.code);
    const raceResult = raceResults.find((r) => r.Driver?.code === d.code);
    const sprintResult = sprintResults.find((r) => r.Driver?.code === d.code);

    const isDnf = raceResult ? isDnfByPositionText(raceResult.positionText) : false;
    const sprintIsDnf = sprintResult ? isDnfByPositionText(sprintResult.positionText) : false;

    // Course déjà courue → grid (post-pénalités) fait foi, même si "0" (pit lane).
    // Sinon → meilleure approximation disponible : le classement brut des qualifs.
    const qualifyingPos = raceResult
      ? (raceResult.grid ? Number(raceResult.grid) : 0)
      : (qualiResult?.position ? Number(qualiResult.position) : 0);

    return {
      driverCode: d.code,
      qualifyingPos: qualifyingPos > 0 ? String(qualifyingPos) : "",
      racePos: raceResult && !isDnf ? String(raceResult.position) : "",
      isDnf,
      // grid du sprint = résultat de la Sprint Qualifying, dispo seulement après la course sprint
      sprintQualiPos: sprintResult?.grid ? String(sprintResult.grid) : "",
      sprintRacePos: sprintResult && !sprintIsDnf ? String(sprintResult.position) : "",
      sprintIsDnf,
    };
  });

  let fastestLap = "";
  for (const result of raceResults) {
    if (result.FastestLap?.rank === "1") {
      fastestLap = result.Driver?.code ?? "";
      break;
    }
  }

  const mapped = rows.filter(
    (r) => r.qualifyingPos || r.racePos || r.isDnf || r.sprintQualiPos || r.sprintRacePos || r.sprintIsDnf
  ).length;

  if (mapped === 0) {
    return { ok: false, error: "Aucune donnée disponible sur Jolpica pour ce GP (ni qualifs, ni sprint, ni course)." };
  }

  return { ok: true, rows, fastestLap, mapped };
}
