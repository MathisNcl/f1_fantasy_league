import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import RegisterForm from "@/components/auth/RegisterForm";
import Link from "next/link";

export default async function RegisterPage() {
  const session = await auth();
  if (session) redirect("/dashboard");

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-red-500 tracking-wider">F1</h1>
          <p className="text-white text-xl font-semibold mt-1">Fantasy League</p>
        </div>
        <div className="bg-gray-900 rounded-2xl shadow-2xl p-8 border border-gray-800">
          <h2 className="text-white text-2xl font-bold mb-2">Créer un compte</h2>
          <p className="text-gray-400 text-sm mb-6">
            Seules les adresses email autorisées par l&apos;admin peuvent s&apos;inscrire.
          </p>
          <RegisterForm />
          <p className="text-center text-gray-500 text-sm mt-6">
            Déjà un compte ?{" "}
            <Link href="/login" className="text-red-400 hover:text-red-300 font-medium transition-colors">
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
