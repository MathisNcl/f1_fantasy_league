import { DRIVERS, STRATEGIES } from "./constants";

// Points F1 officiels par position d'arrivée (course principale)
const F1_RACE_POINTS: Record<number, number> = {
  1: 25,
  2: 18,
  3: 15,
  4: 12,
  5: 10,
  6: 8,
  7: 6,
  8: 4,
  9: 2,
  10: 1,
};

// Points F1 format sprint officiel
const F1_SPRINT_POINTS: Record<number, number> = {
  1: 8,
  2: 7,
  3: 6,
  4: 5,
  5: 4,
  6: 3,
  7: 2,
  8: 1,
};

export type DriverResultData = {
  driverCode: string;
  // Course principale
  qualifyingPos: number | null; // = grille de départ
  racePos: number | null;
  isDnf: boolean;
  // Sprint (week-end sprint uniquement)
  sprintQualiPos: number | null; // = grille sprint
  sprintRacePos: number | null;
  sprintIsDnf: boolean;
};

export type PickData = {
  userId: string;
  driver1: string;
  driver2: string;
  /** Énergie effective de driver1 pour ce week-end (0.0–1.0, inclut boost huile_moteur) */
  driver1Energy: number;
  /** Énergie effective de driver2 pour ce week-end (0.0–1.0, inclut boost huile_moteur) */
  driver2Energy: number;
  team: string;
  strategy: string;
  drsTarget: string | null;
  huileMoteurTarget: string | null;
};

export type RaceResultData = {
  fastestLap: string;
  hasRedFlag: boolean;
  hasSprintRedFlag: boolean;
  driverResults: DriverResultData[];
};

// ---------------------------------------------------------------------------
// Types de décomposition du score
// ---------------------------------------------------------------------------

export type DriverBreakdown = {
  code: string;
  energy: number;          // 0.0–1.0
  qualiPos: number | null; // position de départ (grille)
  raceFinishPos: number | null; // position d'arrivée
  posGain: number;         // nombre de places remontées (0 si aucune)
  posLost: boolean;        // a perdu des positions
  posGainPts: number;      // pts rapportés par les positions remontées
  hasFastestLap: boolean;  // a réalisé le meilleur tour
  hasDnf: boolean;         // abandon
  qualiPts: number;        // points qualif principale (après ×2 si soft)
  racePts: number;         // points course principale (après multiplicateur stratégie)
  sprintQualiPts: number;
  sprintRacePts: number;
  rawContrib: number;      // somme des 4 composantes (avant énergie)
  finalContrib: number;    // après applyEnergy
};

export type ScoreBreakdown = {
  d1: DriverBreakdown;
  d2: DriverBreakdown;
  teamPts: number;
  sprintTeamPts: number;
  bonusPts: number;
  superDurPts: number;
  pluieActivated: boolean;
  fiaCancelled: boolean;
  strategyNote: string;  // note lisible sur l'effet de la stratégie
  drsGain: number;       // points gagnés via DRS (0 si non activé)
  undercutLoss: number;  // points perdus à cause d'un undercut adverse (≤ 0)
  total: number;         // score final (après DRS/Undercut)
};

// ---------------------------------------------------------------------------
// Points de qualifications principales
// ---------------------------------------------------------------------------
function getQualiPoints(pos: number): number {
  if (pos === 1) return 12;
  if (pos === 2) return 10;
  if (pos === 3) return 8;
  if (pos === 4) return 6;
  if (pos <= 10) return 5;  // Q3 positions 5-10
  if (pos <= 16) return 2;  // éliminé en Q2
  return 0;                  // éliminé en Q1
}

// ---------------------------------------------------------------------------
// Points de sprint qualifying (barème réduit)
// ---------------------------------------------------------------------------
function getSprintQualiPoints(pos: number): number {
  if (pos === 1) return 6;
  if (pos === 2) return 5;
  if (pos === 3) return 4;
  if (pos === 4) return 3;
  if (pos <= 10) return 2;  // SQ3 positions 5-10
  if (pos <= 16) return 1;  // éliminé en SQ2
  return 0;                  // éliminé en SQ1
}

// ---------------------------------------------------------------------------
// Points de course principale pour un pilote
// ---------------------------------------------------------------------------
// Malus pour les 3 derniers finishers (hors DNF) : -3, -2, -1
function getTailPenalty(racePos: number, lastFinishPos: number): number {
  const diff = lastFinishPos - racePos;
  if (diff === 0) return -3;
  if (diff === 1) return -2;
  if (diff === 2) return -1;
  return 0;
}

function getRacePtsForDriver(
  dr: DriverResultData,
  fastestLap: string,
  lastFinishPos: number = 0
): number {
  if (dr.isDnf) return -5;
  if (dr.racePos === null) return 0;

  let pts = F1_RACE_POINTS[dr.racePos] ?? 0;

  if (dr.qualifyingPos !== null) {
    const gain = dr.qualifyingPos - dr.racePos;
    if (gain > 0) pts += Math.min(gain, 10);      // +1 par place remontée (max 10)
    else if (gain < 0) pts -= 2;   // -2 flat si perte de positions
  }

  if (dr.driverCode === fastestLap) pts += 5;

  if (lastFinishPos > 0) pts += getTailPenalty(dr.racePos, lastFinishPos);

  return pts;
}

// Variante Ultra Tendre : double les places remontées
function calcRacePtsUltraTendre(
  dr: DriverResultData | null,
  fastestLap: string,
  lastFinishPos: number = 0
): number {
  if (!dr) return 0;
  if (dr.isDnf) return -5;
  if (dr.racePos === null) return 0;

  let pts = F1_RACE_POINTS[dr.racePos] ?? 0;

  if (dr.qualifyingPos !== null) {
    const gain = dr.qualifyingPos - dr.racePos;
    if (gain > 0) pts += Math.min(gain * 2, 10);
    else if (gain < 0) pts -= 2;
  }

  if (dr.driverCode === fastestLap) pts += 5;

  if (lastFinishPos > 0) pts += getTailPenalty(dr.racePos, lastFinishPos);

  return pts;
}

// ---------------------------------------------------------------------------
// Points de course sprint — barème F1 sprint officiel, sans bonus/malus
// ---------------------------------------------------------------------------
function getSprintRacePtsForDriver(dr: DriverResultData): number {
  if (dr.sprintIsDnf || dr.sprintRacePos === null) return 0;
  return F1_SPRINT_POINTS[dr.sprintRacePos] ?? 0;
}

// ---------------------------------------------------------------------------
// Points d'écurie (course principale) : MOYENNE des points F1 des 2 pilotes
// ---------------------------------------------------------------------------
function getTeamPoints(teamName: string, driverResults: DriverResultData[]): number {
  const teamDriverCodes = DRIVERS.filter((d) => d.team === teamName).map((d) => d.code);
  let total = 0;
  for (const code of teamDriverCodes) {
    const dr = driverResults.find((r) => r.driverCode === code);
    if (dr && !dr.isDnf && dr.racePos !== null) {
      total += F1_RACE_POINTS[dr.racePos] ?? 0;
    }
  }
  return teamDriverCodes.length > 0 ? total / teamDriverCodes.length : 0;
}

// Points d'écurie (sprint) : MOYENNE des points F1 sprint des 2 pilotes
function getSprintTeamPoints(teamName: string, driverResults: DriverResultData[]): number {
  const teamDriverCodes = DRIVERS.filter((d) => d.team === teamName).map((d) => d.code);
  let total = 0;
  for (const code of teamDriverCodes) {
    const dr = driverResults.find((r) => r.driverCode === code);
    if (dr && !dr.sprintIsDnf && dr.sprintRacePos !== null) {
      total += F1_SPRINT_POINTS[dr.sprintRacePos] ?? 0;
    }
  }
  return teamDriverCodes.length > 0 ? total / teamDriverCodes.length : 0;
}

// ---------------------------------------------------------------------------
// Application du multiplicateur d'énergie (uniquement sur les points positifs)
// ---------------------------------------------------------------------------
function applyEnergy(rawPts: number, energy: number): number {
  if (rawPts <= 0) return rawPts;
  return rawPts * energy;
}

// ---------------------------------------------------------------------------
// Construit la note lisible sur l'effet de la stratégie
// ---------------------------------------------------------------------------
function buildStrategyNote(
  strategy: string,
  fiaCancelled: boolean,
  superDurPts: number,
  dnfCount: number,
  pluieActivated: boolean,
  huileMoteurTarget: string | null
): string {
  if (fiaCancelled) {
    return strategy === "fia"
      ? "FIA : stratégies annulées pour tout le monde"
      : "Stratégie annulée (FIA jouée ce week-end)";
  }
  switch (strategy) {
    case "soft":         return "Soft : qualifications ×2";
    case "hard":         return "Hard : points de course ×2";
    case "ultra_tendre": return "Ultra Tendre : places remontées ×2";
    case "super_dur":    return `Super Dur : +${superDurPts} pts (${dnfCount} abandon${dnfCount > 1 ? "s" : ""})`;
    case "pluie":        return pluieActivated ? "Pluie : total ×2 (drapeau rouge)" : "Pluie : pas de drapeau rouge";
    case "moteur":       return "Moteur : aucune fatigue appliquée ce week-end";
    case "huile_moteur": return huileMoteurTarget ? `Huile moteur : +10% énergie → ${huileMoteurTarget}` : "Huile moteur";
    case "undercut":     return "Undercut : −10% de vos pts retirés aux joueurs devant vous";
    case "drs":          return "DRS : vous gagnez les pts de votre cible si vous scorez moins";
    case "medium":       return "";
    default:             return "";
  }
}

// ---------------------------------------------------------------------------
// Calcule la décomposition individuelle d'un pick (sans DRS/Undercut)
// ---------------------------------------------------------------------------
type IndividualBreakdown = Omit<ScoreBreakdown, "drsGain" | "undercutLoss" | "total"> & {
  baseTotal: number;
};

function calculateIndividualBreakdown(
  pick: PickData,
  result: RaceResultData,
  isSprint: boolean,
  fiaCancelled: boolean
): IndividualBreakdown {
  const { driverResults, fastestLap, hasRedFlag, hasSprintRedFlag } = result;
  const dr1 = driverResults.find((r) => r.driverCode === pick.driver1);
  const dr2 = driverResults.find((r) => r.driverCode === pick.driver2);

  const dnfCount = driverResults.filter((r) => r.isDnf).length;

  // Position du dernier finisher (hors DNF) pour le malus queue de peloton
  const finisherPositions = driverResults
    .filter((r) => !r.isDnf && r.racePos !== null)
    .map((r) => r.racePos as number);
  const lastFinishPos = finisherPositions.length > 0 ? Math.max(...finisherPositions) : 0;

  // --- Qualifications principales ---
  let qualiPts1 = dr1?.qualifyingPos ? getQualiPoints(dr1.qualifyingPos) : 0;
  let qualiPts2 = dr2?.qualifyingPos ? getQualiPoints(dr2.qualifyingPos) : 0;

  // --- Sprint Qualifications ---
  let sprintQualiPts1 = 0;
  let sprintQualiPts2 = 0;
  if (isSprint) {
    sprintQualiPts1 = dr1?.sprintQualiPos ? getSprintQualiPoints(dr1.sprintQualiPos) : 0;
    sprintQualiPts2 = dr2?.sprintQualiPos ? getSprintQualiPoints(dr2.sprintQualiPos) : 0;
  }

  if (!fiaCancelled && pick.strategy === "soft") {
    qualiPts1 *= 2;
    qualiPts2 *= 2;
    sprintQualiPts1 *= 2;
    sprintQualiPts2 *= 2;
  }

  // --- Course principale ---
  let racePts1 = 0;
  let racePts2 = 0;

  if (!fiaCancelled && pick.strategy === "ultra_tendre") {
    racePts1 = calcRacePtsUltraTendre(dr1 ?? null, fastestLap, lastFinishPos);
    racePts2 = calcRacePtsUltraTendre(dr2 ?? null, fastestLap, lastFinishPos);
  } else {
    racePts1 = dr1 ? getRacePtsForDriver(dr1, fastestLap, lastFinishPos) : 0;
    racePts2 = dr2 ? getRacePtsForDriver(dr2, fastestLap, lastFinishPos) : 0;
  }

  if (!fiaCancelled && pick.strategy === "hard") {
    racePts1 *= 2;
    racePts2 *= 2;
  }

  // --- Course sprint ---
  let sprintRacePts1 = 0;
  let sprintRacePts2 = 0;
  if (isSprint) {
    sprintRacePts1 = dr1 ? getSprintRacePtsForDriver(dr1) : 0;
    sprintRacePts2 = dr2 ? getSprintRacePtsForDriver(dr2) : 0;
    if (!fiaCancelled && pick.strategy === "hard") {
      sprintRacePts1 *= 2;
      sprintRacePts2 *= 2;
    }
  }

  // --- Contributions brutes par pilote ---
  const d1Raw = qualiPts1 + sprintQualiPts1 + racePts1 + sprintRacePts1;
  const d2Raw = qualiPts2 + sprintQualiPts2 + racePts2 + sprintRacePts2;

  // --- Après énergie ---
  const d1Final = applyEnergy(d1Raw, pick.driver1Energy);
  const d2Final = applyEnergy(d2Raw, pick.driver2Energy);

  // --- Détails course principale par pilote ---
  const ultraTendre = !fiaCancelled && pick.strategy === "ultra_tendre";

  const d1posGain = (dr1 && !dr1.isDnf && dr1.qualifyingPos !== null && dr1.racePos !== null)
    ? Math.max(0, dr1.qualifyingPos - dr1.racePos) : 0;
  const d1posLost = !!(dr1 && !dr1.isDnf && dr1.qualifyingPos !== null && dr1.racePos !== null
    && dr1.qualifyingPos < dr1.racePos);
  const d1posGainPts = Math.min(ultraTendre ? d1posGain * 2 : d1posGain, 10);
  const d1hasFl = !!(dr1 && !dr1.isDnf && dr1.racePos !== null && dr1.driverCode === fastestLap);

  const d2posGain = (dr2 && !dr2.isDnf && dr2.qualifyingPos !== null && dr2.racePos !== null)
    ? Math.max(0, dr2.qualifyingPos - dr2.racePos) : 0;
  const d2posLost = !!(dr2 && !dr2.isDnf && dr2.qualifyingPos !== null && dr2.racePos !== null
    && dr2.qualifyingPos < dr2.racePos);
  const d2posGainPts = Math.min(ultraTendre ? d2posGain * 2 : d2posGain, 10);
  const d2hasFl = !!(dr2 && !dr2.isDnf && dr2.racePos !== null && dr2.driverCode === fastestLap);

  // --- Écurie ---
  const teamPts = getTeamPoints(pick.team, driverResults);
  const sprintTeamPts = isSprint ? getSprintTeamPoints(pick.team, driverResults) : 0;

  // --- Bonus course principale ---
  let bonusPts = 0;
  const dr1Finished = dr1 && !dr1.isDnf && dr1.racePos !== null;
  const dr2Finished = dr2 && !dr2.isDnf && dr2.racePos !== null;
  const dr2Dnf = dr2?.isDnf ?? false;
  if (dr1Finished) {
    if (dr2Dnf) {
      // driver1 terminé, driver2 abandon → driver1 devant
      bonusPts += 5;
    } else if (dr2Finished) {
      if (dr1!.racePos! < dr2!.racePos!) bonusPts += 5;
      const positions = new Set([dr1!.racePos!, dr2!.racePos!]);
      if (positions.has(1) && positions.has(2)) bonusPts += 20;
    }
  }

  // --- Super Dur ---
  let superDurPts = 0;
  if (!fiaCancelled && pick.strategy === "super_dur") {
    superDurPts = dnfCount * 5;
  }

  let total = d1Final + d2Final + teamPts + sprintTeamPts + bonusPts + superDurPts;

  // --- Pluie ---
  const pluieActivated =
    !fiaCancelled &&
    pick.strategy === "pluie" &&
    (hasRedFlag || (isSprint && hasSprintRedFlag));
  if (pluieActivated) total *= 2;

  return {
    d1: {
      code: pick.driver1,
      energy: pick.driver1Energy,
      qualiPos: dr1?.qualifyingPos ?? null,
      raceFinishPos: dr1?.racePos ?? null,
      posGain: d1posGain,
      posLost: d1posLost,
      posGainPts: d1posGainPts,
      hasFastestLap: d1hasFl,
      hasDnf: dr1?.isDnf ?? false,
      qualiPts: qualiPts1,
      racePts: racePts1,
      sprintQualiPts: sprintQualiPts1,
      sprintRacePts: sprintRacePts1,
      rawContrib: d1Raw,
      finalContrib: d1Final,
    },
    d2: {
      code: pick.driver2,
      energy: pick.driver2Energy,
      qualiPos: dr2?.qualifyingPos ?? null,
      raceFinishPos: dr2?.racePos ?? null,
      posGain: d2posGain,
      posLost: d2posLost,
      posGainPts: d2posGainPts,
      hasFastestLap: d2hasFl,
      hasDnf: dr2?.isDnf ?? false,
      qualiPts: qualiPts2,
      racePts: racePts2,
      sprintQualiPts: sprintQualiPts2,
      sprintRacePts: sprintRacePts2,
      rawContrib: d2Raw,
      finalContrib: d2Final,
    },
    teamPts,
    sprintTeamPts,
    bonusPts,
    superDurPts,
    pluieActivated,
    fiaCancelled,
    strategyNote: buildStrategyNote(
      pick.strategy,
      fiaCancelled,
      superDurPts,
      dnfCount,
      pluieActivated,
      pick.huileMoteurTarget
    ),
    baseTotal: Math.round(total),
  };
}

// ---------------------------------------------------------------------------
// Calcule scores + décompositions complètes (avec DRS/Undercut)
// ---------------------------------------------------------------------------
export function calculateAllScoresWithBreakdown(
  picks: PickData[],
  result: RaceResultData,
  isSprint: boolean
): { scores: Record<string, number>; breakdowns: Record<string, ScoreBreakdown> } {
  const hasAnyFIA = picks.some((p) => p.strategy === "fia");

  const baseBreakdowns: Record<string, IndividualBreakdown> = {};
  const baseScores: Record<string, number> = {};

  for (const pick of picks) {
    const bd = calculateIndividualBreakdown(pick, result, isSprint, hasAnyFIA);
    baseBreakdowns[pick.userId] = bd;
    baseScores[pick.userId] = bd.baseTotal;
  }

  if (hasAnyFIA) {
    const breakdowns: Record<string, ScoreBreakdown> = {};
    for (const pick of picks) {
      const bd = baseBreakdowns[pick.userId];
      breakdowns[pick.userId] = { ...bd, drsGain: 0, undercutLoss: 0, total: bd.baseTotal };
    }
    return { scores: baseScores, breakdowns };
  }

  const ranked = Object.entries(baseScores).sort((a, b) => b[1] - a[1]);

  // Undercut deltas
  const undercutDeltas: Record<string, number> = {};
  for (const pick of picks) {
    if (pick.strategy !== "undercut") continue;
    const myScore = baseScores[pick.userId] ?? 0;
    const myRank = ranked.findIndex(([uid]) => uid === pick.userId);
    const deduction = Math.round(myScore * 0.1);
    for (let i = 0; i < myRank; i++) {
      const targetId = ranked[i][0];
      undercutDeltas[targetId] = (undercutDeltas[targetId] ?? 0) - deduction;
    }
  }

  // DRS deltas
  const drsDeltas: Record<string, number> = {};
  for (const pick of picks) {
    if (pick.strategy !== "drs" || !pick.drsTarget) continue;
    const myScore = baseScores[pick.userId] ?? 0;
    const targetScore = baseScores[pick.drsTarget] ?? 0;
    if (myScore < targetScore) {
      drsDeltas[pick.userId] = (drsDeltas[pick.userId] ?? 0) + targetScore;
    }
  }

  // Scores finaux
  const finalScores: Record<string, number> = { ...baseScores };
  for (const [uid, delta] of Object.entries(undercutDeltas)) {
    finalScores[uid] = (finalScores[uid] ?? 0) + delta;
  }
  for (const [uid, delta] of Object.entries(drsDeltas)) {
    finalScores[uid] = (finalScores[uid] ?? 0) + delta;
  }

  // Breakdowns complets
  const breakdowns: Record<string, ScoreBreakdown> = {};
  for (const pick of picks) {
    const bd = baseBreakdowns[pick.userId];
    breakdowns[pick.userId] = {
      ...bd,
      drsGain: drsDeltas[pick.userId] ?? 0,
      undercutLoss: undercutDeltas[pick.userId] ?? 0,
      total: finalScores[pick.userId] ?? bd.baseTotal,
    };
  }

  return { scores: finalScores, breakdowns };
}

// ---------------------------------------------------------------------------
// Calcule tous les scores du week-end (gère FIA, Undercut, DRS)
// ---------------------------------------------------------------------------
export function calculateAllScores(
  picks: PickData[],
  result: RaceResultData,
  isSprint: boolean
): Record<string, number> {
  return calculateAllScoresWithBreakdown(picks, result, isSprint).scores;
}

// ---------------------------------------------------------------------------
// Calcule les stats de scoring de base pour un pilote (sans énergie/stratégie)
// Stockées directement sur DriverResult lors de la saisie des résultats.
// ---------------------------------------------------------------------------
export function computeDriverScoringStats(dr: DriverResultData, fastestLap: string, lastFinishPos: number = 0) {
  const scoringQualiPts = dr.qualifyingPos !== null
    ? getQualiPoints(dr.qualifyingPos)
    : null;

  const scoringRacePts = (dr.racePos !== null || dr.isDnf)
    ? getRacePtsForDriver(dr, fastestLap, lastFinishPos)
    : null;

  const scoringSprintQualiPts = dr.sprintQualiPos !== null
    ? getSprintQualiPoints(dr.sprintQualiPos)
    : null;

  const scoringSprintRacePts = (dr.sprintRacePos !== null && !dr.sprintIsDnf)
    ? getSprintRacePtsForDriver(dr)
    : null;

  const scoringPosGainPts = (!dr.isDnf && dr.qualifyingPos !== null && dr.racePos !== null)
    ? Math.min(Math.max(0, dr.qualifyingPos - dr.racePos), 10)
    : null;

  const scoringPosLost = (!dr.isDnf && dr.qualifyingPos !== null && dr.racePos !== null)
    ? dr.qualifyingPos < dr.racePos
    : null;

  return {
    scoringQualiPts,
    scoringRacePts,
    scoringSprintQualiPts,
    scoringSprintRacePts,
    scoringPosGainPts,
    scoringPosLost,
  };
}

// ---------------------------------------------------------------------------
// Retourne le nombre de tokens restants pour chaque stratégie
// ---------------------------------------------------------------------------
export function getRemainingTokens(
  picks: Array<{ strategy: string; race: { season: number } }>,
  season: number
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const strat of STRATEGIES) {
    const used = picks.filter(
      (p) => p.strategy === strat.code && p.race.season === season
    ).length;
    result[strat.code] = Math.max(0, strat.tokens - used);
  }
  return result;
}
