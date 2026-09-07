import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { applyManualEnergyAdjustment } from "@/lib/energyReplay";

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

  const { updated } = await applyManualEnergyAdjustment(season, percent / 100);

  return NextResponse.json({ success: true, updated });
}
