import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { STRATEGIES } from "@/lib/constants";
import { getRemainingTokens } from "@/lib/scoring";
import { getPicksOpenDate, getPicksDeadline } from "@/lib/dates";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const picks = await prisma.pick.findMany({
    where: { userId: session.user.id },
    include: { race: true },
    orderBy: { createdAt: "desc" },
  });

  const scores = await prisma.score.findMany({
    where: { userId: session.user.id },
  });

  const picksWithScores = picks.map((pick) => ({
    ...pick,
    score: scores.find((s) => s.raceId === pick.raceId) ?? null,
  }));

  return NextResponse.json(picksWithScores);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const body = await request.json();
  const { raceId, driver1, driver2, team, strategy, drsTarget, huileMoteurTarget } = body;

  if (!raceId || !driver1 || !driver2 || !team || !strategy) {
    return NextResponse.json({ error: "Champs manquants" }, { status: 400 });
  }

  if (driver1 === driver2) {
    return NextResponse.json(
      { error: "Vous devez choisir deux pilotes différents" },
      { status: 400 }
    );
  }

  // Vérifier que la stratégie existe
  const stratDef = STRATEGIES.find((s) => s.code === strategy);
  if (!stratDef) {
    return NextResponse.json({ error: "Stratégie invalide" }, { status: 400 });
  }

  // Vérifier que la course existe et que la deadline n'est pas passée
  const race = await prisma.race.findUnique({ where: { id: Number(raceId) } });
  if (!race) {
    return NextResponse.json({ error: "Course introuvable" }, { status: 404 });
  }

  const now = new Date();
  const openDate = getPicksOpenDate(race.date);
  const deadline = getPicksDeadline(race.date, race.deadline);

  if (now < openDate) {
    return NextResponse.json(
      { error: "Le formulaire n'est pas encore ouvert pour cette course" },
      { status: 400 }
    );
  }
  if (now >= deadline) {
    return NextResponse.json(
      { error: "La deadline de soumission est passée" },
      { status: 400 }
    );
  }

  // Valider la cible DRS si nécessaire
  if (strategy === "drs") {
    if (!drsTarget) {
      return NextResponse.json(
        { error: "La stratégie DRS requiert une cible" },
        { status: 400 }
      );
    }
    const targetExists = await prisma.user.findUnique({ where: { id: drsTarget } });
    if (!targetExists) {
      return NextResponse.json({ error: "Cible DRS introuvable" }, { status: 400 });
    }
  }

  // Valider la cible Huile moteur si nécessaire
  if (strategy === "huile_moteur") {
    if (!huileMoteurTarget || (huileMoteurTarget !== driver1 && huileMoteurTarget !== driver2)) {
      return NextResponse.json(
        { error: "La stratégie Huile moteur requiert une cible parmi vos 2 pilotes" },
        { status: 400 }
      );
    }
  }

  const userId = session.user.id!;

  // Récupérer les picks de la saison pour valider les tokens de stratégie
  const pastPicks = await prisma.pick.findMany({
    where: { userId, race: { season: race.season } },
    include: { race: true },
  });

  const existingPick = await prisma.pick.findUnique({
    where: { userId_raceId: { userId, raceId: Number(raceId) } },
  });
  const picksForTokenCount = existingPick
    ? pastPicks.filter((p) => p.raceId !== Number(raceId))
    : pastPicks;

  // Vérifier les tokens de stratégie
  const remaining = getRemainingTokens(picksForTokenCount, race.season);
  if ((remaining[strategy] ?? 0) <= 0) {
    return NextResponse.json(
      { error: `Plus de tokens disponibles pour la stratégie ${stratDef.label}` },
      { status: 400 }
    );
  }

  const pick = await prisma.pick.upsert({
    where: { userId_raceId: { userId, raceId: Number(raceId) } },
    update: {
      driver1,
      driver2,
      team,
      strategy,
      drsTarget: strategy === "drs" ? drsTarget : null,
      huileMoteurTarget: strategy === "huile_moteur" ? huileMoteurTarget : null,
    },
    create: {
      userId,
      raceId: Number(raceId),
      driver1,
      driver2,
      team,
      strategy,
      drsTarget: strategy === "drs" ? drsTarget : null,
      huileMoteurTarget: strategy === "huile_moteur" ? huileMoteurTarget : null,
    },
  });

  return NextResponse.json(pick, { status: 201 });
}
