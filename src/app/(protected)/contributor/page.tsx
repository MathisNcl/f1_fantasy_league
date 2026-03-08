import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ResultsForm from "@/components/admin/ResultsForm";

export default async function ContributorPage() {
  const session = await auth();
  const user = session?.user as { role?: string } | undefined;

  if (!session || (user?.role !== "CONTRIBUTOR" && user?.role !== "ADMIN")) {
    redirect("/dashboard");
  }

  const races = await prisma.race.findMany({
    where: { season: new Date().getFullYear() },
    include: { result: true },
    orderBy: { date: "asc" },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Saisie des résultats</h1>
        <p className="text-gray-400 mt-1">Saison {new Date().getFullYear()}</p>
      </div>

      <div className="max-w-2xl">
        <ResultsForm races={races} />
      </div>
    </div>
  );
}
