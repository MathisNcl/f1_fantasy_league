import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DRIVERS } from "@/lib/constants";

async function requireAdmin() {
  const session = await auth();
  const user = session?.user as { role?: string } | undefined;
  if (!session || user?.role !== "ADMIN") return null;
  return session;
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = await request.json();
  const percent = Number(body.percent);
  const season = Number(body.season) || new Date().getFullYear();

  if (!Number.isFinite(percent) || percent === 0) {
    return NextResponse.json({ error: "Pourcentage invalide." }, { status: 400 });
  }

  const delta = percent / 100;

  const users = await prisma.user.findMany({ select: { id: true } });
  const existing = await prisma.driverEnergy.findMany({ where: { season } });

  const existingByKey = new Map(
    existing.map((rec) => [`${rec.userId}:${rec.driverCode}`, rec])
  );

  const operations = [];

  for (const user of users) {
    for (const driver of DRIVERS) {
      const key = `${user.id}:${driver.code}`;
      const current = existingByKey.get(key)?.energy ?? 1.0;
      const next = Math.max(0, Math.min(1.0, current + delta));

      operations.push(
        prisma.driverEnergy.upsert({
          where: {
            userId_driverCode_season: {
              userId: user.id,
              driverCode: driver.code,
              season,
            },
          },
          update: { energy: next },
          create: { userId: user.id, driverCode: driver.code, energy: next, season },
        })
      );
    }
  }

  await prisma.$transaction(operations);

  return NextResponse.json({ success: true, updated: operations.length });
}
