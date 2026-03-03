import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const scores = await prisma.score.groupBy({
    by: ["userId"],
    _sum: { points: true },
    _count: { id: true },
  });

  const userIds = scores.map((s) => s.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true },
  });

  const leaderboard = scores
    .map((s) => {
      const user = users.find((u) => u.id === s.userId);
      return {
        userId: s.userId,
        name: user?.name ?? "Inconnu",
        totalPoints: s._sum.points ?? 0,
        pickCount: s._count.id,
      };
    })
    .sort((a, b) => b.totalPoints - a.totalPoints);

  return NextResponse.json(leaderboard);
}
