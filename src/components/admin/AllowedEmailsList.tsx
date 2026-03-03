"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AllowedEmail } from "@prisma/client";

type Props = {
  allowedEmails: AllowedEmail[];
};

export default function AllowedEmailsList({ allowedEmails }: Props) {
  const router = useRouter();
  const [newEmail, setNewEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    const res = await fetch("/api/admin/allowed-emails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: newEmail }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setMessage({ type: "error", text: data.error ?? "Erreur lors de l'ajout." });
      return;
    }

    setMessage({ type: "success", text: `${newEmail} ajouté à la liste.` });
    setNewEmail("");
    router.refresh();
  }

  async function handleDelete(id: string, email: string) {
    setDeletingId(id);

    const res = await fetch("/api/admin/allowed-emails", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    setDeletingId(null);

    if (!res.ok) {
      setMessage({ type: "error", text: `Impossible de supprimer ${email}.` });
      return;
    }

    router.refresh();
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Emails autorisés</h2>
          <p className="text-gray-400 text-sm mt-0.5">
            Seuls ces emails peuvent créer un compte.
          </p>
        </div>
        <span className="text-gray-400 text-sm bg-gray-800 px-3 py-1 rounded-full">
          {allowedEmails.length} email{allowedEmails.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Formulaire ajout */}
      <form onSubmit={handleAdd} className="flex gap-2 mb-4">
        <input
          type="email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          required
          placeholder="nouveau@email.com"
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-colors text-sm"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-yellow-600 hover:bg-yellow-500 disabled:bg-yellow-900 disabled:cursor-not-allowed text-white font-semibold px-4 py-2 rounded-lg transition-colors text-sm whitespace-nowrap"
        >
          {loading ? "Ajout..." : "Ajouter"}
        </button>
      </form>

      {message && (
        <p
          className={`text-sm rounded-lg px-4 py-2.5 border mb-4 ${
            message.type === "success"
              ? "text-green-400 bg-green-950 border-green-800"
              : "text-red-400 bg-red-950 border-red-800"
          }`}
        >
          {message.text}
        </p>
      )}

      {/* Liste */}
      {allowedEmails.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-4">
          Aucun email autorisé. Ajoutez-en un ci-dessus.
        </p>
      ) : (
        <div className="space-y-1.5">
          {allowedEmails.map((entry) => {
            const isRegistered = false; // sera enrichi côté server si besoin
            return (
              <div
                key={entry.id}
                className="flex items-center justify-between bg-gray-800 rounded-lg px-4 py-2.5"
              >
                <span className="text-gray-200 text-sm font-mono">{entry.email}</span>
                <button
                  onClick={() => handleDelete(entry.id, entry.email)}
                  disabled={deletingId === entry.id}
                  className="text-gray-500 hover:text-red-400 disabled:cursor-not-allowed transition-colors text-xs font-medium ml-4"
                >
                  {deletingId === entry.id ? "..." : "Retirer"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
