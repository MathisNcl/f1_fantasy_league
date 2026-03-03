export const DRIVERS = [
  { code: "VER", name: "Max Verstappen", team: "Red Bull" },
  { code: "HAD", name: "Isack Hadjar", team: "Red Bull" },
  { code: "NOR", name: "Lando Norris", team: "McLaren" },
  { code: "PIA", name: "Oscar Piastri", team: "McLaren" },
  { code: "LEC", name: "Charles Leclerc", team: "Ferrari" },
  { code: "HAM", name: "Lewis Hamilton", team: "Ferrari" },
  { code: "RUS", name: "George Russell", team: "Mercedes" },
  { code: "ANT", name: "Andrea Kimi Antonelli", team: "Mercedes" },
  { code: "ALO", name: "Fernando Alonso", team: "Aston Martin" },
  { code: "STR", name: "Lance Stroll", team: "Aston Martin" },
  { code: "GAS", name: "Pierre Gasly", team: "Alpine" },
  { code: "COL", name: "Franco Colapinto", team: "Alpine" },
  { code: "ALB", name: "Alexander Albon", team: "Williams" },
  { code: "SAI", name: "Carlos Sainz", team: "Williams" },
  { code: "LIN", name: "Arvid Lindblad", team: "RB" },
  { code: "LAW", name: "Liam Lawson", team: "RB" },
  { code: "HUL", name: "Nico Hülkenberg", team: "Audi" },
  { code: "BOR", name: "Gabriel Bortoleto", team: "Audi" },
  { code: "OCO", name: "Esteban Ocon", team: "Haas" },
  { code: "BEA", name: "Oliver Bearman", team: "Haas" },
  { code: "PER", name: "Sergio Perez", team: "Cadillac" },
  { code: "BOT", name: "Valtteri Bottas", team: "Cadillac" },
] as const;

export const TEAMS = [
  "Red Bull",
  "McLaren",
  "Ferrari",
  "Mercedes",
  "Aston Martin",
  "Alpine",
  "Williams",
  "RB",
  "Audi",
  "Haas",
  "Cadillac",
] as const;

/**
 * Stratégies disponibles par week-end.
 * tokens = nombre d'utilisations max par saison.
 */
export const STRATEGIES = [
  {
    code: "ultra_tendre",
    label: "Ultra Tendre",
    description: "Double les points des places remontées en course",
    tokens: 2,
    color: "red" as const,
  },
  {
    code: "soft",
    label: "Soft",
    description: "Double les points de qualifications",
    tokens: 2,
    color: "yellow" as const,
  },
  {
    code: "medium",
    label: "Medium",
    description: "Aucun effet — option sécurisée",
    tokens: 7,
    color: "gray" as const,
  },
  {
    code: "hard",
    label: "Hard",
    description: "Double les points en course (bonus et malus inclus)",
    tokens: 2,
    color: "white" as const,
  },
  {
    code: "super_dur",
    label: "Super Dur",
    description: "+10 pts par abandon dans la course",
    tokens: 2,
    color: "orange" as const,
  },
  {
    code: "pluie",
    label: "Pluie",
    description: "Double tous vos points du week-end si drapeau rouge",
    tokens: 2,
    color: "blue" as const,
  },
  {
    code: "undercut",
    label: "Undercut",
    description: "Enlève 10% de vos points à chaque joueur vous précédant",
    tokens: 1,
    color: "purple" as const,
  },
  {
    code: "drs",
    label: "DRS",
    description: "Choisissez un adversaire : si vous finissez derrière lui, vous gagnez ses points",
    tokens: 1,
    color: "green" as const,
  },
  {
    code: "moteur",
    label: "Changement de moteur",
    description: "Aucune fatigue appliquée à vos pilotes ce week-end",
    tokens: 1,
    color: "cyan" as const,
  },
  {
    code: "huile_moteur",
    label: "Huile moteur",
    description: "+10% d'énergie avant la course à l'un de vos 2 pilotes sélectionnés",
    tokens: 3,
    color: "orange" as const,
  },
  {
    code: "fia",
    label: "FIA",
    description: "Annule toutes les stratégies du week-end pour tout le monde",
    tokens: 1,
    color: "red" as const,
  },
] as const;

export type DriverCode = (typeof DRIVERS)[number]["code"];
export type TeamName = (typeof TEAMS)[number];
export type StrategyCode = (typeof STRATEGIES)[number]["code"];
