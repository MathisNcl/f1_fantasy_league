"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function EnergyAdjust() {
  const router = useRouter();
  const [percent, setPercent] = useState("10");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function apply(sign: 1 | -1) {
    const value = Number(percent);
    if (!Number.isFinite(value) || value <= 0) {
      setMessage({ type: "error", text: "Entrez un pourcentage valide." });
      return;
    }

    const signedValue = value * sign;
    const label = sign === 1 ? "+" : "-";

    if (
      !confirm(
        `Appliquer ${label}${value}% d'énergie à tous les pilotes de tous les utilisateurs ?`
      )
    ) {
      return;
    }

    setMessage(null);
    setLoading(true);

    const res = await fetch("/api/admin/energy-adjust", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ percent: signedValue }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setMessage({ type: "error", text: data.error ?? "Erreur lors de l'application." });
      return;
    }

    setMessage({ type: "success", text: `Énergie ajustée de ${label}${value}% pour tous les pilotes.` });
    router.refresh();
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-white">Ajustement énergie global</h2>
        <p className="text-gray-400 text-sm mt-0.5">
          Applique un delta d&apos;énergie à tous les pilotes de tous les utilisateurs (saison en cours).
        </p>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            value={percent}
            onChange={(e) => setPercent(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 pr-8 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-colors text-sm"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">%</span>
        </div>
        <button
          type="button"
          onClick={() => apply(1)}
          disabled={loading}
          className="bg-green-700 hover:bg-green-600 disabled:bg-green-950 disabled:cursor-not-allowed text-white font-semibold px-4 py-2 rounded-lg transition-colors text-sm whitespace-nowrap"
        >
          {loading ? "..." : "+ Ajouter"}
        </button>
        <button
          type="button"
          onClick={() => apply(-1)}
          disabled={loading}
          className="bg-red-700 hover:bg-red-600 disabled:bg-red-950 disabled:cursor-not-allowed text-white font-semibold px-4 py-2 rounded-lg transition-colors text-sm whitespace-nowrap"
        >
          {loading ? "..." : "- Retirer"}
        </button>
      </div>

      {message && (
        <p
          className={`text-sm rounded-lg px-4 py-2.5 border mt-4 ${
            message.type === "success"
              ? "text-green-400 bg-green-950 border-green-800"
              : "text-red-400 bg-red-950 border-red-800"
          }`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
