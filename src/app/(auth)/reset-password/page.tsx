"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  if (!token) {
    return (
      <div className="bg-red-950 border border-red-800 rounded-lg px-4 py-4 text-center">
        <p className="text-red-400 font-medium">Lien invalide ou expiré.</p>
        <Link href="/forgot-password" className="text-red-400 underline text-sm mt-2 inline-block">
          Demander un nouveau lien
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setErrorMsg("Les mots de passe ne correspondent pas.");
      return;
    }
    setStatus("loading");
    setErrorMsg("");
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    if (res.ok) {
      setStatus("success");
      setTimeout(() => router.push("/login"), 2500);
    } else {
      const data = await res.json();
      setErrorMsg(data.error ?? "Erreur inattendue.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="bg-green-950 border border-green-800 rounded-lg px-4 py-4 text-center">
        <p className="text-green-400 font-medium">Mot de passe mis à jour !</p>
        <p className="text-green-500 text-sm mt-1">Redirection vers la connexion…</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">
          Nouveau mot de passe
        </label>
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-colors"
          placeholder="6 caractères minimum"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">
          Confirmer le mot de passe
        </label>
        <input
          type="password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-colors"
          placeholder="Répétez le mot de passe"
        />
      </div>

      {errorMsg && <p className="text-red-400 text-sm">{errorMsg}</p>}

      <button
        type="submit"
        disabled={status === "loading"}
        className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors"
      >
        {status === "loading" ? "Enregistrement…" : "Réinitialiser le mot de passe"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-red-500 tracking-wider">F1</h1>
          <p className="text-white text-xl font-semibold mt-1">Fantasy League</p>
        </div>
        <div className="bg-gray-900 rounded-2xl shadow-2xl p-8 border border-gray-800">
          <h2 className="text-white text-2xl font-bold mb-6">Nouveau mot de passe</h2>
          <Suspense fallback={<p className="text-gray-400 text-sm">Chargement…</p>}>
            <ResetPasswordForm />
          </Suspense>
          <p className="text-center text-gray-500 text-sm mt-6">
            <Link href="/login" className="text-red-400 hover:text-red-300 font-medium transition-colors">
              ← Retour à la connexion
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
