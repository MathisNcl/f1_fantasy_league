import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ResultsForm from "@/components/admin/ResultsForm";
import RaceForm from "@/components/admin/RaceForm";
import UsersList from "@/components/admin/UsersList";
import AllowedEmailsList from "@/components/admin/AllowedEmailsList";

export default async function AdminPage() {
  const session = await auth();
  const user = session?.user as { role?: string } | undefined;

  if (!session || user?.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const [races, users, allowedEmails] = await Promise.all([
    prisma.race.findMany({
      where: { season: new Date().getFullYear() },
      include: { result: true },
      orderBy: { date: "asc" },
    }),
    prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.allowedEmail.findMany({
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Panneau Admin</h1>
        <p className="text-gray-400 mt-1">Gestion de la saison {new Date().getFullYear()}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <RaceForm />
        <ResultsForm races={races} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <AllowedEmailsList allowedEmails={allowedEmails} />
        <UsersList users={users} />
      </div>
    </div>
  );
}
