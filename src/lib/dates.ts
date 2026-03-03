/**
 * Utilitaires de dates pour les créneaux d'ouverture/fermeture des picks.
 *
 * Règle :
 *   - Ouverture : lundi 9h00 (heure Paris) de la semaine de la course
 *   - Fermeture : vendredi 19h00 (heure Paris) de la semaine de la course
 *                 (peut être surchargé par race.deadline)
 *
 * Gestion timezone : CET (UTC+1) en hiver, CEST (UTC+2) en été.
 */

/** Dernier dimanche d'un mois donné (pour le changement d'heure). */
function lastSundayOfMonth(year: number, month: number): Date {
  // month : 0 = janvier, 2 = mars, 9 = octobre
  const lastDay = new Date(Date.UTC(year, month + 1, 0));
  const dow = lastDay.getUTCDay();
  return new Date(Date.UTC(year, month, lastDay.getUTCDate() - dow));
}

/** Offset UTC de Paris à une date donnée (+1 CET, +2 CEST). */
function parisUtcOffset(date: Date): number {
  const year = date.getUTCFullYear();
  const cestStart = lastSundayOfMonth(year, 2); // dernier dimanche de mars
  const cestEnd = lastSundayOfMonth(year, 9);   // dernier dimanche d'octobre
  return date >= cestStart && date < cestEnd ? 2 : 1;
}

/**
 * Calcule la date d'ouverture du formulaire de picks :
 * Lundi 9h00 (Paris) de la semaine de la course.
 */
export function getPicksOpenDate(raceDate: Date): Date {
  const d = new Date(raceDate);
  const dow = d.getUTCDay(); // 0 = dimanche
  const toMonday = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + toMonday);
  const offset = parisUtcOffset(d);
  d.setUTCHours(9 - offset, 0, 0, 0);
  return d;
}

/**
 * Calcule la deadline de soumission des picks :
 * Vendredi 19h00 (Paris) de la semaine de la course.
 * Utilise race.deadline s'il est défini.
 */
export function getPicksDeadline(raceDate: Date, customDeadline?: Date | null): Date {
  if (customDeadline) return customDeadline;
  const d = new Date(raceDate);
  const dow = d.getUTCDay();
  const toFriday = dow === 0 ? -2 : 5 - dow;
  d.setUTCDate(d.getUTCDate() + toFriday);
  const offset = parisUtcOffset(d);
  d.setUTCHours(19 - offset, 0, 0, 0);
  return d;
}

/** Formatte une date en "lundi 8 mars à 9h00" (heure locale du navigateur). */
export function formatPicksDate(date: Date): string {
  const dayName = date.toLocaleDateString("fr-FR", { weekday: "long" });
  const dayNum = date.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
  const time = date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return `${dayName} ${dayNum} à ${time}`;
}
