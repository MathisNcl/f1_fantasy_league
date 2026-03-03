"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RaceForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState("");
  const [round, setRound] = useState("");
  const [season, setSeason] = useState(String(new Date().getFullYear()));
  const [hasSprint, setHasSprint] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const inputClass =
    "w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-colors text-sm";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    const res = await fetch("/api/races", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, location, date, round: Number(round), season: Number(season), hasSprint }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setMessage({ type: "error", text: data.error ?? "Erreur lors de l'ajout." });
      return;
    }

    setMessage({ type: "success", text: "Grand Prix ajouté avec succès !" });
    setName("");
    setLocation("");
    setDate("");
    setRound("");
    setHasSprint(false);
    router.refresh();
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
      <h2 className="text-xl font-semibold text-white mb-4">
        Ajouter un Grand Prix
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Nom
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Grand Prix de Monaco"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Lieu
            </label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              required
              placeholder="Monaco"
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Date de course
            </label>
            <input
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Round
            </label>
            <input
              type="number"
              value={round}
              onChange={(e) => setRound(e.target.value)}
              required
              min={1}
              max={24}
              placeholder="1"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Saison
            </label>
            <input
              type="number"
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              required
              className={inputClass}
            />
          </div>
        </div>

        <label className="flex items-center gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={hasSprint}
            onChange={(e) => setHasSprint(e.target.checked)}
            className="w-4 h-4 accent-purple-500"
          />
          <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">
            Weekend Sprint
          </span>
          {hasSprint && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-purple-900 text-purple-300 border border-purple-700">
              SPRINT
            </span>
          )}
        </label>

        {message && (
          <p
            className={`text-sm rounded-lg px-4 py-3 border ${
              message.type === "success"
                ? "text-green-400 bg-green-950 border-green-800"
                : "text-red-400 bg-red-950 border-red-800"
            }`}
          >
            {message.text}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-yellow-600 hover:bg-yellow-500 disabled:bg-yellow-900 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors text-sm"
        >
          {loading ? "Ajout en cours..." : "Ajouter le GP"}
        </button>
      </form>
    </div>
  );
}
