import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyResetToken } from "@/lib/email";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  const { token, password } = await req.json();
  if (!token || !password) return NextResponse.json({ error: "Champs manquants" }, { status: 400 });
  if (password.length < 6) return NextResponse.json({ error: "Mot de passe trop court (6 caractères min)" }, { status: 400 });

  const userId = await verifyResetToken(token);
  if (!userId) return NextResponse.json({ error: "Lien invalide ou expiré" }, { status: 400 });

  const hashed = await bcrypt.hash(password, 12);
  await prisma.user.update({ where: { id: userId }, data: { password: hashed } });

  return NextResponse.json({ ok: true });
}
