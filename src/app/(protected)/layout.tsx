import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { signOut } from "@/lib/auth";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const user = session.user as { role?: string; name?: string; email?: string };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-red-500 text-2xl font-bold">F1</span>
            <span className="text-white font-semibold text-lg">Fantasy League</span>
          </div>
          <nav className="flex items-center gap-6">
            <a
              href="/dashboard"
              className="text-gray-300 hover:text-white transition-colors text-sm font-medium"
            >
              Dashboard
            </a>
            <a
              href="/regles"
              className="text-gray-300 hover:text-white transition-colors text-sm font-medium"
            >
              Règles
            </a>
            {user?.role === "ADMIN" && (
              <a
                href="/admin"
                className="text-yellow-400 hover:text-yellow-300 transition-colors text-sm font-medium"
              >
                Admin
              </a>
            )}
            <span className="text-gray-400 text-sm">{user?.name}</span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button
                type="submit"
                className="text-gray-400 hover:text-red-400 transition-colors text-sm"
              >
                Déconnexion
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
