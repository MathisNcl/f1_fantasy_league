import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { transporter } from "@/lib/email";

// Fenêtre de détection : deadline entre now+12h et now+36h
// Le cron tourne à 9h UTC chaque jour ; la large fenêtre couvre les deadlines
// matinales (ex: 5h CET = 4h UTC = ~19h après un cron à 9h UTC).
const WINDOW_MIN_MS = 12 * 60 * 60 * 1000;
const WINDOW_MAX_MS = 36 * 60 * 60 * 1000;

function buildEmailHtml(userName: string, raceName: string, deadline: Date, appUrl: string) {
  const deadlineStr = deadline.toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Rappel F1 Fantasy</title>
</head>
<body style="margin:0;padding:0;background:#111;font-family:Arial,sans-serif;color:#fff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:40px auto;">
    <tr>
      <td style="background:#1a1a2e;border-radius:12px;padding:32px;border:1px solid #333;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding-bottom:24px;border-bottom:1px solid #333;">
              <span style="font-size:22px;font-weight:bold;color:#e10600;">F1</span>
              <span style="font-size:18px;font-weight:600;color:#fff;margin-left:8px;">Fantasy League</span>
            </td>
          </tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;">
          <tr>
            <td style="font-size:24px;font-weight:bold;color:#fff;padding-bottom:8px;">
              ⏰ Rappel — ${raceName}
            </td>
          </tr>
          <tr>
            <td style="color:#aaa;font-size:15px;padding-bottom:24px;line-height:1.6;">
              Bonjour <strong style="color:#fff;">${userName}</strong>,<br/><br/>
              Tu n'as pas encore soumis tes paris pour le <strong style="color:#fff;">${raceName}</strong>.<br/>
              La deadline est dans moins de 24h :
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:24px;">
              <div style="background:#2a1a1a;border:1px solid #e10600;border-radius:8px;padding:16px;text-align:center;">
                <span style="color:#e10600;font-size:13px;text-transform:uppercase;letter-spacing:1px;">Deadline</span><br/>
                <strong style="color:#fff;font-size:18px;">${deadlineStr}</strong>
              </div>
            </td>
          </tr>
          <tr>
            <td style="text-align:center;padding-bottom:8px;">
              <a href="${appUrl}/dashboard"
                 style="display:inline-block;background:#e10600;color:#fff;font-weight:bold;font-size:15px;text-decoration:none;padding:14px 32px;border-radius:8px;">
                Déposer mes paris →
              </a>
            </td>
          </tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px;border-top:1px solid #333;padding-top:16px;">
          <tr>
            <td style="color:#555;font-size:12px;text-align:center;">
              Tu reçois ce mail car tu es inscrit sur F1 Fantasy League.<br/>
              Si tu as déjà soumis tes paris, ignore ce message.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function GET(req: NextRequest) {
  // Vérification du secret
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const from = `F1 Fantasy League <${process.env.GMAIL_USER}>`;
  const now = new Date();

  // Cherche le prochain GP dont la deadline tombe dans la fenêtre ~24h
  const windowStart = new Date(now.getTime() + WINDOW_MIN_MS);
  const windowEnd = new Date(now.getTime() + WINDOW_MAX_MS);

  const race = await prisma.race.findFirst({
    where: {
      OR: [
        { deadline: { gte: windowStart, lte: windowEnd } },
        { deadline: null, date: { gte: windowStart, lte: windowEnd } },
      ],
    },
    orderBy: { date: "asc" },
  });

  if (!race) {
    return NextResponse.json({ skipped: "no race in 24h window" });
  }

  const deadline = race.deadline ?? race.date;

  // Récupère tous les users et les picks déjà soumis pour ce GP
  const [allUsers, existingPicks] = await Promise.all([
    prisma.user.findMany({ select: { id: true, name: true, email: true } }),
    prisma.pick.findMany({ where: { raceId: race.id }, select: { userId: true } }),
  ]);

  const userIdsWithPick = new Set(existingPicks.map((p) => p.userId));
  const usersWithoutPick = allUsers.filter((u) => !userIdsWithPick.has(u.id));

  if (usersWithoutPick.length === 0) {
    return NextResponse.json({ sent: 0, race: race.name, skipped: "all users have picks" });
  }

  // Envoi des emails en parallèle
  const results = await Promise.allSettled(
    usersWithoutPick.map((user) =>
      transporter.sendMail({
        from,
        to: user.email,
        subject: `⏰ Rappel — Paris F1 : ${race.name}`,
        html: buildEmailHtml(user.name, race.name, deadline, appUrl),
      })
    )
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  return NextResponse.json({
    race: race.name,
    deadline: deadline.toISOString(),
    sent,
    failed,
    skipped: userIdsWithPick.size,
  });
}
