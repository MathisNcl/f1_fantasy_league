import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchJolpicaResults } from "@/lib/jolpica";
import { previewRaceScores } from "@/lib/previewRaceScore";
import { DriverResultData } from "@/lib/scoring";

// Fenêtre de recherche : course dans les ±3 jours autour de maintenant, pour
// retrouver le GP du week-end en cours peu importe le soir (ven/sam/dim) où le
// cron se déclenche.
const WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  // Uniquement la prochaine course SANS résultat officiel : on ne veut jamais
  // recalculer un aperçu provisoire pour une course déjà notée par un admin.
  const race = await prisma.race.findFirst({
    where: {
      result: { is: null },
      date: { gte: new Date(now.getTime() - WINDOW_MS), lte: new Date(now.getTime() + WINDOW_MS) },
    },
    orderBy: { date: "asc" },
  });

  if (!race) {
    return NextResponse.json({ skipped: "no un-scored race this weekend" });
  }

  const result = await fetchJolpicaResults(race.season, race.round, race.hasSprint);
  if (!result.ok) {
    return NextResponse.json({ race: race.name, skipped: result.error });
  }

  if (result.mapped === 0) {
    return NextResponse.json({ race: race.name, skipped: "no driver mapped from Jolpica" });
  }

  const driverResults: DriverResultData[] = result.rows.map((row) => ({
    driverCode: row.driverCode,
    qualifyingPos: row.qualifyingPos ? Number(row.qualifyingPos) : null,
    racePos: row.isDnf ? null : row.racePos ? Number(row.racePos) : null,
    isDnf: row.isDnf,
    sprintQualiPos: row.sprintQualiPos ? Number(row.sprintQualiPos) : null,
    sprintRacePos: row.sprintIsDnf ? null : row.sprintRacePos ? Number(row.sprintRacePos) : null,
    sprintIsDnf: row.sprintIsDnf,
  }));

  const preview = await previewRaceScores({
    raceId: race.id,
    fastestLap: result.fastestLap,
    hasRedFlag: false,
    hasSprintRedFlag: false,
    driverResults,
  });

  if (!preview) {
    return NextResponse.json({ race: race.name, skipped: "race disappeared" });
  }

  const entries = Object.entries(preview.scores);

  await prisma.$transaction([
    prisma.provisionalScore.deleteMany({ where: { raceId: race.id } }),
    ...entries.map(([userId, points]) =>
      prisma.provisionalScore.create({
        data: {
          userId,
          raceId: race.id,
          points,
          breakdown: JSON.stringify(preview.breakdowns[userId]),
        },
      })
    ),
  ]);

  return NextResponse.json({
    race: race.name,
    mapped: result.mapped,
    fastestLap: result.fastestLap,
    provisionalScoresUpdated: entries.length,
  });
}
