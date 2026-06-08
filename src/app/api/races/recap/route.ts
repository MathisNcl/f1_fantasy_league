import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const raceId = Number(searchParams.get("raceId"));
  if (!raceId) return NextResponse.json({ error: "raceId manquant" }, { status: 400 });

  const race = await prisma.race.findUnique({
    where: { id: raceId },
    include: { result: true },
  });
  if (!race?.result) return NextResponse.json({ error: "Aucun résultat pour ce GP" }, { status: 404 });

  const [picks, scores, allUsers] = await Promise.all([
    prisma.pick.findMany({ where: { raceId } }),
    prisma.score.findMany({ where: { raceId } }),
    prisma.user.findMany({ select: { id: true, name: true } }),
  ]);

  const entries = picks
    .map((p) => {
      const drsTargetUser = p.drsTarget ? allUsers.find((u) => u.id === p.drsTarget) : null;
      const scoreRecord = scores.find((s) => s.userId === p.userId);
      return {
        userId: p.userId,
        userName: allUsers.find((u) => u.id === p.userId)?.name ?? "Inconnu",
        driver1: p.driver1,
        driver2: p.driver2,
        team: p.team,
        strategy: p.strategy,
        drsTarget: p.drsTarget,
        drsTargetName: drsTargetUser?.name ?? null,
        huileMoteurTarget: p.huileMoteurTarget,
        score: scoreRecord?.points ?? null,
        breakdown: scoreRecord?.breakdown ?? null,
      };
    })
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  return NextResponse.json({
    race: {
      id: race.id,
      name: race.name,
      round: race.round,
      location: race.location,
      date: race.date.toISOString(),
      hasSprint: race.hasSprint,
    },
    entries,
  });
}
