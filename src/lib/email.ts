import nodemailer from "nodemailer";
import { SignJWT, jwtVerify } from "jose";

// Transporter Gmail — utilise les App Passwords (2FA requis)
export const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET ?? "fallback");

export async function generateResetToken(userId: string): Promise<string> {
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("1h")
    .setIssuedAt()
    .sign(secret);
}

export async function verifyResetToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return (payload.userId as string) ?? null;
  } catch {
    return null;
  }
}

export async function sendResetEmail(to: string, token: string): Promise<void> {
  const url = `${process.env.NEXT_PUBLIC_APP_URL}reset-password?token=${encodeURIComponent(token)}`;
  await transporter.sendMail({
    from: `"F1 Fantasy League" <${process.env.GMAIL_USER}>`,
    to,
    subject: "Réinitialisation de votre mot de passe",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2 style="color:#ef4444">F1 Fantasy League</h2>
        <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>
        <p>Ce lien est valable <strong>1 heure</strong>.</p>
        <a href="${url}" style="display:inline-block;margin:16px 0;padding:12px 24px;background:#ef4444;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold">
          Réinitialiser mon mot de passe
        </a>
        <p style="color:#888;font-size:12px">Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
      </div>
    `,
  });
}
