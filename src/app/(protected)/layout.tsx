import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { signOut } from "@/lib/auth";
import Navbar from "@/components/layout/Navbar";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const user = session.user as { role?: string; name?: string; email?: string };

  const signOutForm = (
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
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Navbar
        userName={user?.name ?? ""}
        isAdmin={user?.role === "ADMIN"}
        isContributor={user?.role === "CONTRIBUTOR"}
        signOutForm={signOutForm}
      />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">{children}</main>
    </div>
  );
}
