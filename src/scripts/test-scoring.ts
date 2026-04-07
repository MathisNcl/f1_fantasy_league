/**
 * Tests unitaires du système de scoring
 * Usage : npx tsx src/scripts/test-scoring.ts
 *
 * Chaque test indique le calcul manuel attendu en commentaire.
 */
import { calculateAllScores, type PickData, type RaceResultData } from "../lib/scoring";

// ─── Mini framework ───────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(name: string, actual: number, expected: number) {
  if (actual === expected) {
    console.log(`  ✅ ${name}: ${actual}`);
    passed++;
  } else {
    console.error(`  ❌ ${name}: obtenu=${actual}, attendu=${expected}`);
    failed++;
  }
}

function score(picks: PickData[], result: RaceResultData, isSprint = false): Record<string, number> {
  return calculateAllScores(picks, result, isSprint);
}

// ─── Données de base réutilisables ────────────────────────────────────────────

/** Résultat standard : VER P1, NOR P2, PIA P3, HAD P4 — pas de FL pour nos pilotes */
const BASE_RESULT: RaceResultData = {
  fastestLap: "LEC",
  hasRedFlag: false,
  hasSprintRedFlag: false,
  driverResults: [
    { driverCode: "VER", qualifyingPos: 1, racePos: 1,  isDnf: false, sprintQualiPos: null, sprintRacePos: null, sprintIsDnf: false },
    { driverCode: "NOR", qualifyingPos: 3, racePos: 2,  isDnf: false, sprintQualiPos: null, sprintRacePos: null, sprintIsDnf: false },
    { driverCode: "PIA", qualifyingPos: 2, racePos: 3,  isDnf: false, sprintQualiPos: null, sprintRacePos: null, sprintIsDnf: false },
    { driverCode: "HAD", qualifyingPos: 4, racePos: 4,  isDnf: false, sprintQualiPos: null, sprintRacePos: null, sprintIsDnf: false },
    { driverCode: "LEC", qualifyingPos: 5, racePos: 5,  isDnf: false, sprintQualiPos: null, sprintRacePos: null, sprintIsDnf: false },
    { driverCode: "HAM", qualifyingPos: 6, racePos: 6,  isDnf: false, sprintQualiPos: null, sprintRacePos: null, sprintIsDnf: false },
  ],
};

function basePick(overrides: Partial<PickData> = {}): PickData {
  return {
    userId: "A",
    driver1: "VER",
    driver2: "NOR",
    driver1Energy: 1.0,
    driver2Energy: 1.0,
    team: "McLaren",
    strategy: "medium",
    drsTarget: null,
    huileMoteurTarget: null,
    ...overrides,
  } as PickData;
}

// ─── TEST 1 : Cas de base (medium, énergie 100%) ──────────────────────────────
// VER : quali=12(P1) + course=25(P1, 0 gain) = 37
// NOR : quali=8(P3)  + course=19(P2, +1 gain) = 27
// McLaren team : (NOR P2=18 + PIA P3=15) / 2 = 16.5
// Bonus : VER(P1) devant NOR(P2) → +5 ; P1+P2 → +20 ; total = +25
// TOTAL = 37 + 27 + 16.5 + 25 = 105.5 → arrondi = 106
console.log("\n── Test 1 : Base case (medium, énergie 100%) ──");
{
  const s = score([basePick()], BASE_RESULT);
  assert("score", s["A"], 106);
}

// ─── TEST 2 : Énergie 80% sur driver2 ────────────────────────────────────────
// NOR rawContrib = 27 → 27 * 0.8 = 21.6
// TOTAL = 37 + 21.6 + 16.5 + 25 = 100.1 → 100
console.log("\n── Test 2 : Énergie 80% sur driver2 ──");
{
  const s = score([basePick({ driver2Energy: 0.8 })], BASE_RESULT);
  assert("score", s["A"], 100);
}

// ─── TEST 3 : Énergie 0% — les points positifs deviennent 0 ──────────────────
// driver1Energy=0.0, driver2Energy=0.0
// VER contrib = 37 * 0.0 = 0
// NOR contrib = 27 * 0.0 = 0
// Seuls teamPts (16.5) + bonus (25) restent = 41.5 → 42
console.log("\n── Test 3 : Énergie 0% ──");
{
  const s = score([basePick({ driver1Energy: 0.0, driver2Energy: 0.0 })], BASE_RESULT);
  assert("score", s["A"], 42);
}

// ─── TEST 4 : Énergie ne touche pas les points négatifs ──────────────────────
// NOR : qualiPos=16 (1pt) + DNF (-5) = rawContrib = -4 (négatif → énergie ignorée)
// VER : 37 * 1.0 = 37
// McLaren team : NOR DNF→0, PIA P3→15 → 15/2 = 7.5
// bonus : NOR DNF → dr2Finished=false → 0
// TOTAL = 37 + (-4) + 7.5 + 0 = 40.5 → 41
console.log("\n── Test 4 : Énergie ignorée sur contribution négative ──");
{
  const result: RaceResultData = {
    ...BASE_RESULT,
    driverResults: BASE_RESULT.driverResults.map((d) =>
      d.driverCode === "NOR"
        ? { ...d, qualifyingPos: 16, racePos: null, isDnf: true }
        : d
    ),
  };
  const s = score([basePick({ driver2Energy: 0.5 })], result);
  // NOR rawContrib = 1 + (-5) = -4, applyEnergy(-4, 0.5) = -4 (inchangé)
  assert("score", s["A"], 41);
}

// ─── TEST 5 : Stratégie Soft (qualif ×2) ─────────────────────────────────────
// VER : quali=12*2=24 + course=25 = 49
// NOR : quali=8*2=16  + course=19 = 35
// teamPts=16.5, bonus=25
// TOTAL = 49 + 35 + 16.5 + 25 = 125.5 → 126
console.log("\n── Test 5 : Soft (qualif ×2) ──");
{
  const s = score([basePick({ strategy: "soft" })], BASE_RESULT);
  assert("score", s["A"], 126);
}

// ─── TEST 6 : Stratégie Hard (course ×2) ─────────────────────────────────────
// VER : quali=12 + course=25*2=50 = 62
// NOR : quali=8  + course=19*2=38 = 46
// teamPts=16.5, bonus=25
// TOTAL = 62 + 46 + 16.5 + 25 = 149.5 → 150
console.log("\n── Test 6 : Hard (course ×2) ──");
{
  const s = score([basePick({ strategy: "hard" })], BASE_RESULT);
  assert("score", s["A"], 150);
}

// ─── TEST 7 : Stratégie Ultra Tendre (places remontées ×2) ───────────────────
// VER : qualiPos=5, racePos=1 → gain=4 → pts=25+4*2=33 | qualiPts=5(P5 Q3)
// NOR : qualiPos=3, racePos=2 → gain=1 → pts=18+1*2=20 | qualiPts=8(P3)
// rawContrib_VER = 5+33=38, rawContrib_NOR=8+20=28
// McLaren: NOR P2=18, PIA P3=15 → 16.5
// bonus: VER(P1) devant NOR(P2) → +25
// TOTAL = 38 + 28 + 16.5 + 25 = 107.5 → 108
console.log("\n── Test 7 : Ultra Tendre (remontées ×2) ──");
{
  const result: RaceResultData = {
    ...BASE_RESULT,
    driverResults: BASE_RESULT.driverResults.map((d) => {
      if (d.driverCode === "VER") return { ...d, qualifyingPos: 5, racePos: 1 };
      return d;
    }),
  };
  const s = score([basePick({ strategy: "ultra_tendre" })], result);
  assert("score", s["A"], 108);
}

// ─── TEST 8 : Super Dur (+5 par DNF) ─────────────────────────────────────────
// 2 DNFs (NOR + HAM)
// NOR : qualiPts=8 + racePts=-5 = rawContrib=3 > 0 → energy 1.0 = 3
// VER contrib = 37
// McLaren: NOR DNF→0, PIA P3=15 → 7.5
// bonus: 0 (NOR DNF)
// superDurPts = 2 * 5 = 10
// TOTAL = 37 + 3 + 7.5 + 0 + 10 = 57.5 → 58
console.log("\n── Test 8 : Super Dur (+5/DNF) ──");
{
  const result: RaceResultData = {
    ...BASE_RESULT,
    driverResults: BASE_RESULT.driverResults.map((d) => {
      if (d.driverCode === "NOR") return { ...d, racePos: null, isDnf: true };
      if (d.driverCode === "HAM") return { ...d, racePos: null, isDnf: true };
      return d;
    }),
  };
  const s = score([basePick({ strategy: "super_dur" })], result);
  assert("score", s["A"], 68);
}

// ─── TEST 9 : Pluie + drapeau rouge (×2) ─────────────────────────────────────
// Base total avant pluie = 105.5 (même que test 1)
// pluie + hasRedFlag → × 2 = 211 → 211
console.log("\n── Test 9 : Pluie + drapeau rouge (×2) ──");
{
  const result: RaceResultData = { ...BASE_RESULT, hasRedFlag: true };
  const s = score([basePick({ strategy: "pluie" })], result);
  assert("score", s["A"], 211);
}

// ─── TEST 10 : Week-end Sprint ────────────────────────────────────────────────
// VER : SQ1=6pts, SR1=8pts | qualiMain=12, courseMain=25 → rawContrib=51
// NOR : SQ2=5pts, SR2=7pts | qualiMain=8,  courseMain=19 → rawContrib=39
// McLaren main : NOR P2=18, PIA P3=15 → 16.5
// McLaren sprint : NOR SR2=7, PIA SR3=6 → 6.5
// bonus = 25
// TOTAL = 51 + 39 + 16.5 + 6.5 + 25 = 138
console.log("\n── Test 10 : Week-end Sprint ──");
{
  const result: RaceResultData = {
    fastestLap: "LEC",
    hasRedFlag: false,
    hasSprintRedFlag: false,
    driverResults: [
      { driverCode: "VER", qualifyingPos: 1, racePos: 1, isDnf: false, sprintQualiPos: 1, sprintRacePos: 1, sprintIsDnf: false },
      { driverCode: "NOR", qualifyingPos: 3, racePos: 2, isDnf: false, sprintQualiPos: 2, sprintRacePos: 2, sprintIsDnf: false },
      { driverCode: "PIA", qualifyingPos: 2, racePos: 3, isDnf: false, sprintQualiPos: 3, sprintRacePos: 3, sprintIsDnf: false },
      { driverCode: "HAD", qualifyingPos: 4, racePos: 4, isDnf: false, sprintQualiPos: 4, sprintRacePos: 4, sprintIsDnf: false },
      { driverCode: "LEC", qualifyingPos: 5, racePos: 5, isDnf: false, sprintQualiPos: 5, sprintRacePos: 5, sprintIsDnf: false },
    ],
  };
  const s = score([basePick()], result, true);
  assert("score", s["A"], 138);
}

// ─── TEST 11 : DRS (gains les points de la cible si on finit derrière) ────────
// A : DRS ciblant B, baseScore = 106
// B : medium, baseScore = 112  (LEC P1, HAM P2, Ferrari team)
// A < B → A gagne +112 → A final = 106 + 112 = 218
// B final = 112 (inchangé)
console.log("\n── Test 11 : Stratégie DRS ──");
{
  const result: RaceResultData = {
    fastestLap: "HAD",
    hasRedFlag: false,
    hasSprintRedFlag: false,
    driverResults: [
      { driverCode: "VER", qualifyingPos: 1, racePos: 2, isDnf: false, sprintQualiPos: null, sprintRacePos: null, sprintIsDnf: false },
      { driverCode: "NOR", qualifyingPos: 3, racePos: 3, isDnf: false, sprintQualiPos: null, sprintRacePos: null, sprintIsDnf: false },
      { driverCode: "LEC", qualifyingPos: 2, racePos: 1, isDnf: false, sprintQualiPos: null, sprintRacePos: null, sprintIsDnf: false },
      { driverCode: "HAM", qualifyingPos: 4, racePos: 4, isDnf: false, sprintQualiPos: null, sprintRacePos: null, sprintIsDnf: false },
      { driverCode: "PIA", qualifyingPos: 5, racePos: 5, isDnf: false, sprintQualiPos: null, sprintRacePos: null, sprintIsDnf: false },
      { driverCode: "SAI", qualifyingPos: 6, racePos: 6, isDnf: false, sprintQualiPos: null, sprintRacePos: null, sprintIsDnf: false },
    ],
  };
  // A : VER(Q1,R2) + NOR(Q3,R3) / McLaren / DRS ciblant B
  // VER : quali=12, course=P2=18, gain=1-2=-1→-2 flat → 18-2=16. rawContrib=12+16=28
  // NOR : quali=8,  course=P3=15, gain=3-3=0 → 15. rawContrib=8+15=23
  // McLaren: NOR P3=15, PIA P5=10 → 12.5
  // bonus: VER(P2) devant NOR(P3) → +5, P1+P2 absent → 5
  // A base = 28 + 23 + 12.5 + 5 = 68.5 → 69

  // B : LEC(Q2,R1) + HAM(Q4,R4) / Ferrari / medium
  // LEC : quali=10(P2), course=P1=25, gain=2-1=+1 → 26. rawContrib=10+26=36
  // HAM : quali=6(P4),  course=P4=12, gain=4-4=0   → 12. rawContrib=6+12=18
  // Ferrari: LEC P1=25, HAM P4=12 → 18.5
  // bonus: LEC(P1) devant HAM(P4) → +5. P1+P4 → rien. bonus=5
  // B base = 36 + 18 + 18.5 + 5 = 77.5 → 78

  // A(69) < B(78) → A gagne +78 → A final = 69 + 78 = 147
  const picks: PickData[] = [
    { userId: "A", driver1: "VER", driver2: "NOR", driver1Energy: 1.0, driver2Energy: 1.0, team: "McLaren", strategy: "drs",    drsTarget: "B",   huileMoteurTarget: null },
    { userId: "B", driver1: "LEC", driver2: "HAM", driver1Energy: 1.0, driver2Energy: 1.0, team: "Ferrari", strategy: "medium", drsTarget: null,  huileMoteurTarget: null },
  ];
  const s = score(picks, result);
  assert("A final (DRS déclenché)", s["A"], 147);
  assert("B final (inchangé)",      s["B"], 78);
}

// ─── TEST 12 : Undercut (−10% des points des joueurs devant) ─────────────────
// A (undercut, rang 2) retire 10% de ses points à chaque joueur devant lui
// Si A=80, B=100 → A retire 10% de 80 = 8 pts à B → B final=92, A final=80
console.log("\n── Test 12 : Undercut ──");
{
  const result: RaceResultData = {
    fastestLap: "VER",
    hasRedFlag: false,
    hasSprintRedFlag: false,
    driverResults: [
      { driverCode: "VER", qualifyingPos: 1, racePos: 1, isDnf: false, sprintQualiPos: null, sprintRacePos: null, sprintIsDnf: false },
      { driverCode: "NOR", qualifyingPos: 2, racePos: 2, isDnf: false, sprintQualiPos: null, sprintRacePos: null, sprintIsDnf: false },
      { driverCode: "LEC", qualifyingPos: 3, racePos: 3, isDnf: false, sprintQualiPos: null, sprintRacePos: null, sprintIsDnf: false },
      { driverCode: "HAM", qualifyingPos: 4, racePos: 4, isDnf: false, sprintQualiPos: null, sprintRacePos: null, sprintIsDnf: false },
      { driverCode: "PIA", qualifyingPos: 5, racePos: 5, isDnf: false, sprintQualiPos: null, sprintRacePos: null, sprintIsDnf: false },
      { driverCode: "SAI", qualifyingPos: 6, racePos: 6, isDnf: false, sprintQualiPos: null, sprintRacePos: null, sprintIsDnf: false },
    ],
  };
  // B : LEC(Q3,R3) + HAM(Q4,R4) / Ferrari / medium — score de référence plus bas
  // A : VER(Q1,R1) + NOR(Q2,R2) / McLaren / undercut — score plus haut → A devant B
  // VER : FL(+2), quali=12, course=P1=25+0=25 → 39
  // NOR : quali=10(P2), course=P2=18+0=18 → 28 (qualPos=2, racePos=2, gain=0)
  // McLaren: NOR P2=18, PIA P5=10 → 14
  // bonus: VER(P1) devant NOR(P2) → +5 ; P1+P2 → +20 = 25
  // A base = 42 + 28 + 14 + 25 = 109

  // LEC : quali=8(P3), course=P3=15, gain=0 → 23
  // HAM : quali=6(P4), course=P4=12, gain=0 → 18
  // Ferrari: LEC P3=15, HAM P4=12 → 13.5
  // bonus: LEC(P3) devant HAM(P4) → +5 ; 0 double podium
  // B base = 23 + 18 + 13.5 + 5 = 59.5 → 60

  // Ranked: A(109) > B(60) → A est rang 0, B est rang 1
  // B joue undercut : rank=1, deduction=Math.round(60*0.1)=6
  //   → retire 6 pts à chaque joueur devant B (rang 0 = A)
  // A final = 109 - 6 = 103, B final = 60

  const picks: PickData[] = [
    { userId: "A", driver1: "VER", driver2: "NOR", driver1Energy: 1.0, driver2Energy: 1.0, team: "McLaren", strategy: "medium",   drsTarget: null, huileMoteurTarget: null },
    { userId: "B", driver1: "LEC", driver2: "HAM", driver1Energy: 1.0, driver2Energy: 1.0, team: "Ferrari", strategy: "undercut", drsTarget: null, huileMoteurTarget: null },
  ];
  const s = score(picks, result);
  assert("A final (après undercut)", s["A"], 103);
  assert("B final (inchangé)",       s["B"], 60);
}

// ─── TEST 13 : FIA (annule toutes les stratégies) ─────────────────────────────
// C joue FIA → toutes les stratégies annulées pour tout le monde
// A (soft) et B (hard) obtiennent leur score "medium" (sans effet stratégie)
// (même résultat que Test 1 pour A et B si leurs pilotes sont identiques)
console.log("\n── Test 13 : FIA (annule tout) ──");
{
  // Avec FIA : soft de A n'a aucun effet
  // A : VER(Q1,R1)+NOR(Q3,R2) / McLaren / soft MAIS fiaCancelled → score medium = 106
  const picks: PickData[] = [
    basePick({ strategy: "soft" }),
    { userId: "C", driver1: "LEC", driver2: "PIA", driver1Energy: 1.0, driver2Energy: 1.0, team: "Red Bull", strategy: "fia", drsTarget: null, huileMoteurTarget: null },
  ];
  const s = score(picks, BASE_RESULT);
  // A sans soft = 106 (Test 1)
  assert("A (soft annulé par FIA)", s["A"], 106);
}

// ─── Résumé ───────────────────────────────────────────────────────────────────
console.log(`\n${"═".repeat(45)}`);
console.log(`  ${passed + failed} tests — ✅ ${passed} passés / ❌ ${failed} échoués`);
console.log(`${"═".repeat(45)}\n`);
if (failed > 0) process.exit(1);
