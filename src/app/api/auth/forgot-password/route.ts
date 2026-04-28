import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateResetToken, sendResetEmail } from "@/lib/email";

export async function POST(req: Request) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: "Email requis" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { email } });

  // Toujours répondre 200 pour ne pas révéler si l'email existe
  if (user) {
    const token = await generateResetToken(user.id);
    await sendResetEmail(email, token);
  }

  return NextResponse.json({ ok: true });
}
