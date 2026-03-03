import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import LoginForm from "@/components/auth/LoginForm";
import Link from "next/link";

type Props = {
  searchParams: Promise<{ registered?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const session = await auth();
  if (session) redirect("/dashboard");

  const params = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-red-500 tracking-wider">F1</h1>
          <p className="text-white text-xl font-semibold mt-1">Fantasy League</p>
        </div>
        <div className="bg-gray-900 rounded-2xl shadow-2xl p-8 border border-gray-800">
          <h2 className="text-white text-2xl font-bold mb-6">Connexion</h2>

          {params.registered && (
            <div className="bg-green-950 border border-green-800 rounded-lg px-4 py-3 mb-5">
              <p className="text-green-400 text-sm font-medium">
                Compte créé avec succès ! Connectez-vous.
              </p>
            </div>
          )}

          <LoginForm />

          <p className="text-center text-gray-500 text-sm mt-6">
            Pas encore de compte ?{" "}
            <Link
              href="/register"
              className="text-red-400 hover:text-red-300 font-medium transition-colors"
            >
              S&apos;inscrire
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
