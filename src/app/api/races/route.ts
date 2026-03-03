import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const races = await prisma.race.findMany({
    where: { season: new Date().getFullYear() },
    orderBy: { date: "asc" },
    include: { result: true },
  });

  return NextResponse.json(races);
}

export async function POST(request: Request) {
  const session = await auth();
  const user = session?.user as { role?: string } | undefined;

  if (!session || user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = await request.json();
  const { name, location, date, round, season, hasSprint } = body;

  if (!name || !location || !date || !round || !season) {
    return NextResponse.json({ error: "Champs manquants" }, { status: 400 });
  }

  const race = await prisma.race.create({
    data: {
      name,
      location,
      date: new Date(date),
      round: Number(round),
      season: Number(season),
      hasSprint: Boolean(hasSprint),
    },
  });

  return NextResponse.json(race, { status: 201 });
}
