import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();
  const user = session?.user as { role?: string } | undefined;
  if (!session || user?.role !== "ADMIN") return null;
  return session;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const emails = await prisma.allowedEmail.findMany({
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(emails);
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = await request.json();
  const email = body.email?.toLowerCase().trim();

  if (!email) {
    return NextResponse.json({ error: "Email requis." }, { status: 400 });
  }

  // Vérifier format basique
  if (!email.includes("@")) {
    return NextResponse.json({ error: "Email invalide." }, { status: 400 });
  }

  const entry = await prisma.allowedEmail.upsert({
    where: { email },
    update: {},
    create: { email },
  });

  return NextResponse.json(entry, { status: 201 });
}

export async function DELETE(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = await request.json();
  const { id } = body;

  if (!id) {
    return NextResponse.json({ error: "ID requis." }, { status: 400 });
  }

  await prisma.allowedEmail.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
