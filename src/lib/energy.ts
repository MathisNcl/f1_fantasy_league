import { DRIVERS } from "./constants";

export type EnergyMap = Record<string, number>; // driverCode -> 0.0–1.0

export type RawPick = {
  userId: string;
  driver1: string;
  driver2: string;
  team: string;
  strategy: string;
  huileMoteurTarget: string | null;
};

export type RaceOutcomeForEnergy = {
  driverCode: string;
  isDnf: boolean;
  racePos: number | null;
};

function clamp(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function getLoserCode(pick: RawPick, results: RaceOutcomeForEnergy[]): string | null {
  const dr1 = results.find((r) => r.driverCode === pick.driver1);
  const dr2 = results.find((r) => r.driverCode === pick.driver2);
  const pos1 = !dr1 || dr1.isDnf || dr1.racePos === null ? Infinity : dr1.racePos;
  const pos2 = !dr2 || dr2.isDnf || dr2.racePos === null ? Infinity : dr2.racePos;
  if (pos1 === pos2) return null;
  return pos1 > pos2 ? pick.driver1 : pick.driver2;
}

/**
 * Applique l'effet d'une course sur l'énergie, à partir de l'énergie pré-course.
 * Deux résultats distincts :
 * - scoringEnergy : énergie utilisée pour multiplier le score DE CETTE course
 *   (inclut le boost huile_moteur, appliqué et clampé avant la course).
 * - postEnergy : énergie stockée pour les courses SUIVANTES (fatigue incluse),
 *   obtenue en appliquant les deltas de fatigue à partir de scoringEnergy puis
 *   en clampant une seule fois. Le clamp n'est donc jamais appliqué deux fois
 *   sur le même delta, et toute la logique est un simple "delta + clamp" —
 *   ce qui la rend rejouable en avant sans perte d'information.
 */
export function applyRaceToEnergy(
  pick: RawPick,
  preEnergy: EnergyMap,
  results: RaceOutcomeForEnergy[],
  hasAnyFIA: boolean
): { scoringEnergy: EnergyMap; postEnergy: EnergyMap } {
  const loserCode = getLoserCode(pick, results);
  const teamDriverCodes = new Set(
    DRIVERS.filter((d) => d.team === pick.team).map((d) => d.code)
  );

  const scoringEnergy: EnergyMap = {};
  const postEnergy: EnergyMap = {};

  for (const { code } of DRIVERS) {
    const pre = preEnergy[code] ?? 1.0;
    const isSelected = code === pick.driver1 || code === pick.driver2;
    const isTeamDriver = teamDriverCodes.has(code);

    // 1. Boost huile moteur — avant la course, affecte le score de ce week-end.
    const huileDelta =
      pick.strategy === "huile_moteur" && pick.huileMoteurTarget === code ? 0.1 : 0;
    const preRace = clamp(pre + huileDelta);
    scoringEnergy[code] = preRace;

    // 2. Fatigue post-course — affecte uniquement les week-ends suivants.
    let delta = 0;
    if (isSelected) {
      if (pick.strategy !== "moteur" || hasAnyFIA) {
        delta -= 0.2; // sélectionné
        if (code === loserCode) delta -= 0.05; // perdant
      }
    } else if (!isTeamDriver) {
      delta += 0.05; // non sélectionné, hors écurie
    }
    if (isTeamDriver) delta -= 0.05; // pilote de l'écurie choisie

    postEnergy[code] = clamp(preRace + delta);
  }

  return { scoringEnergy, postEnergy };
}
