"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-red-500 tracking-wider">F1</h1>
          <p className="text-white text-xl font-semibold mt-1">Fantasy League</p>
        </div>
        <div className="bg-gray-900 rounded-2xl shadow-2xl p-8 border border-gray-800">
          <h2 className="text-white text-2xl font-bold mb-2">Mot de passe oublié</h2>
          <p className="text-gray-400 text-sm mb-6">
            Renseignez votre email et nous vous enverrons un lien de réinitialisation.
          </p>

          {status === "sent" ? (
            <div className="bg-green-950 border border-green-800 rounded-lg px-4 py-4 text-center">
              <p className="text-green-400 font-medium">Email envoyé !</p>
              <p className="text-green-500 text-sm mt-1">
                Vérifiez votre boîte mail. Le lien est valable 1 heure.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Adresse email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-colors"
                  placeholder="vous@exemple.com"
                />
              </div>

              {status === "error" && (
                <p className="text-red-400 text-sm">Une erreur est survenue. Réessayez.</p>
              )}

              <button
                type="submit"
                disabled={status === "loading"}
                className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors"
              >
                {status === "loading" ? "Envoi en cours…" : "Envoyer le lien"}
              </button>
            </form>
          )}

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
