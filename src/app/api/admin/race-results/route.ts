import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await auth();
  const user = session?.user as { role?: string } | undefined;
  if (!session || (user?.role !== "ADMIN" && user?.role !== "CONTRIBUTOR")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const raceId = Number(searchParams.get("raceId"));
  if (!raceId) return NextResponse.json({ error: "raceId manquant" }, { status: 400 });

  const raceResult = await prisma.raceResult.findUnique({
    where: { raceId },
    include: { driverResults: true },
  });

  if (!raceResult) return NextResponse.json({ error: "Aucun résultat pour cette course" }, { status: 404 });

  return NextResponse.json({
    fastestLap: raceResult.fastestLap,
    hasRedFlag: raceResult.hasRedFlag,
    hasSprintRedFlag: raceResult.hasSprintRedFlag,
    driverResults: raceResult.driverResults.map((dr) => ({
      driverCode: dr.driverCode,
      qualifyingPos: dr.qualifyingPos,
      racePos: dr.racePos,
      isDnf: dr.isDnf,
      sprintQualiPos: dr.sprintQualiPos,
      sprintRacePos: dr.sprintRacePos,
      sprintIsDnf: dr.sprintIsDnf,
    })),
  });
}
