import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { DRIVERS } from "@/lib/constants";

type DriverRow = {
  driverCode: string;
  qualifyingPos: string;
  racePos: string;
  isDnf: boolean;
  sprintQualiPos: string;
  sprintRacePos: string;
  sprintIsDnf: boolean;
};

// positionText numérique = a terminé (même doublé) ; "R", "W", "D"... = DNF/DNS
function isDnfByPositionText(positionText: string): boolean {
  return !/^\d+$/.test(positionText);
}

export async function GET(request: Request) {
  const session = await auth();
  const user = session?.user as { role?: string } | undefined;

  if (!session || (user?.role !== "ADMIN" && user?.role !== "CONTRIBUTOR")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const round = searchParams.get("round");
  const season = searchParams.get("season");
  const hasSprint = searchParams.get("hasSprint") === "true";

  if (!round || !season) {
    return NextResponse.json({ error: "round et season requis" }, { status: 400 });
  }

  const base = `https://api.jolpi.ca/ergast/f1/${season}/${round}`;

  try {
    const [qualiRes, raceRes] = await Promise.all([
      fetch(`${base}/qualifying.json`, { cache: "no-store" }),
      fetch(`${base}/results.json`, { cache: "no-store" }),
    ]);

    if (!raceRes.ok) {
      return NextResponse.json(
        { error: "Résultats de course non disponibles sur Jolpica pour ce GP." },
        { status: 404 }
      );
    }

    const [qualiData, raceData] = await Promise.all([
      qualiRes.ok ? qualiRes.json() : Promise.resolve({}),
      raceRes.json(),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const qualiResults: any[] = qualiData.MRData?.RaceTable?.Races?.[0]?.QualifyingResults ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raceResults: any[] = raceData.MRData?.RaceTable?.Races?.[0]?.Results ?? [];

    if (raceResults.length === 0) {
      return NextResponse.json(
        { error: "Aucun résultat de course disponible pour ce GP." },
        { status: 404 }
      );
    }

    // Construire les lignes pour chaque pilote
    const rows: DriverRow[] = DRIVERS.map((d) => {
      const qualiResult = qualiResults.find((r) => r.Driver?.code === d.code);
      const raceResult = raceResults.find((r) => r.Driver?.code === d.code);

      const isDnf = raceResult ? isDnfByPositionText(raceResult.positionText) : false;

      return {
        driverCode: d.code,
        qualifyingPos: qualiResult?.position ? String(qualiResult.position) : "",
        racePos: raceResult && !isDnf ? String(raceResult.position) : "",
        isDnf,
        sprintQualiPos: "",
        sprintRacePos: "",
        sprintIsDnf: false,
      };
    });

    // Fastest lap
    let fastestLap = "";
    for (const result of raceResults) {
      if (result.FastestLap?.rank === "1") {
        fastestLap = result.Driver?.code ?? "";
        break;
      }
    }

    // Sprint (si week-end sprint)
    if (hasSprint) {
      const sprintRes = await fetch(`${base}/sprint.json`, { cache: "no-store" });
      if (sprintRes.ok) {
        const sprintData = await sprintRes.json();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sprintResults: any[] = sprintData.MRData?.RaceTable?.Races?.[0]?.SprintResults ?? [];

        for (const row of rows) {
          const sprintResult = sprintResults.find((r) => r.Driver?.code === row.driverCode);
          if (sprintResult) {
            const sprintDnf = isDnfByPositionText(sprintResult.positionText);
            row.sprintIsDnf = sprintDnf;
            row.sprintRacePos = sprintDnf ? "" : String(sprintResult.position);
            // grid = position de départ sprint = résultat du Sprint Qualifying
            row.sprintQualiPos = sprintResult.grid ? String(sprintResult.grid) : "";
          }
        }
      }
    }

    const mapped = rows.filter((r) => r.qualifyingPos || r.racePos || r.isDnf).length;

    return NextResponse.json({ rows, fastestLap, mapped });
  } catch (err) {
    console.error("[jolpica] Erreur:", err);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des données Jolpica.", detail: String(err) },
      { status: 500 }
    );
  }
}
