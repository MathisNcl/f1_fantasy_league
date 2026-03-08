import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";

export async function PATCH(request: Request) {
  const session = await auth();
  const user = session?.user as { role?: string } | undefined;

  if (!session || user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = await request.json();
  const { userId, role } = body as { userId: string; role: string };

  if (!userId || !role) {
    return NextResponse.json({ error: "Champs manquants" }, { status: 400 });
  }

  const validRoles: Role[] = ["USER", "CONTRIBUTOR", "ADMIN"];
  if (!validRoles.includes(role as Role)) {
    return NextResponse.json({ error: "Rôle invalide" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { role: role as Role },
    select: { id: true, name: true, email: true, role: true },
  });

  return NextResponse.json(updated);
}
