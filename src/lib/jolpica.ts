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

// positionText numérique = a terminé (même doublé) ; "R", "W", "D"... = DNF/DNS
function isDnfByPositionText(positionText: string): boolean {
  return !/^\d+$/.test(positionText);
}

/**
 * Récupère les résultats d'un GP depuis Jolpica-F1 (successeur d'Ergast) et les
 * convertit dans le format attendu par le formulaire de résultats.
 * qualifyingPos/sprintQualiPos = champ `grid` (place de départ réelle, après
 * pénalités éventuelles), jamais le classement brut des qualifs.
 */
export async function fetchJolpicaResults(
  season: number,
  round: number,
  hasSprint: boolean
): Promise<JolpicaFetchResult> {
  const base = `https://api.jolpi.ca/ergast/f1/${season}/${round}`;

  try {
    const raceRes = await fetch(`${base}/results.json`, {
      cache: "no-store",
      headers: { "User-Agent": "F1FantasyLeague/1.0 (+personal project)" },
    });

    if (!raceRes.ok) {
      return { ok: false, error: "Résultats de course non disponibles sur Jolpica pour ce GP." };
    }

    const raceData = await raceRes.json();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raceResults: any[] = raceData.MRData?.RaceTable?.Races?.[0]?.Results ?? [];

    if (raceResults.length === 0) {
      return { ok: false, error: "Aucun résultat de course disponible pour ce GP." };
    }

    const rows: JolpicaDriverRow[] = DRIVERS.map((d) => {
      const raceResult = raceResults.find((r) => r.Driver?.code === d.code);
      const isDnf = raceResult ? isDnfByPositionText(raceResult.positionText) : false;

      // grid = place de départ réelle sur la grille (après pénalités éventuelles),
      // distincte du classement brut des qualifs. "0" = départ des pits (pas de grille attribuée).
      const grid = raceResult?.grid ? Number(raceResult.grid) : 0;

      return {
        driverCode: d.code,
        qualifyingPos: grid > 0 ? String(grid) : "",
        racePos: raceResult && !isDnf ? String(raceResult.position) : "",
        isDnf,
        sprintQualiPos: "",
        sprintRacePos: "",
        sprintIsDnf: false,
      };
    });

    let fastestLap = "";
    for (const result of raceResults) {
      if (result.FastestLap?.rank === "1") {
        fastestLap = result.Driver?.code ?? "";
        break;
      }
    }

    if (hasSprint) {
      const sprintRes = await fetch(`${base}/sprint.json`, {
        cache: "no-store",
        headers: { "User-Agent": "F1FantasyLeague/1.0 (+personal project)" },
      });
      if (sprintRes.ok) {
        const sprintData = await sprintRes.json();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sprintResults: any[] = sprintData.MRData?.RaceTable?.Races?.[0]?.SprintResults ?? [];

        for (const row of rows) {
          const sprintResult = sprintResults.find((r) => r.Driver?.code === row.driverCode);
          if (sprintResult) {
            const sprintDnf = isDnfByPositionText(sprintResult.positionText);
            row.sprintIsDnf = sprintDnf;
            row.sprintRacePos = sprintDnf ? "" : String(sprintResult.position);
            // grid = position de départ sprint = résultat du Sprint Qualifying
            row.sprintQualiPos = sprintResult.grid ? String(sprintResult.grid) : "";
          }
        }
      }
    }

    const mapped = rows.filter((r) => r.qualifyingPos || r.racePos || r.isDnf).length;

    return { ok: true, rows, fastestLap, mapped };
  } catch (err) {
    return { ok: false, error: `Erreur lors de la récupération des données Jolpica : ${String(err)}` };
  }
}
