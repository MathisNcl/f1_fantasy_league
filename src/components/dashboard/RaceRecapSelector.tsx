"use client";

import { useState } from "react";
import LastRaceRecap from "@/components/dashboard/LastRaceRecap";

type RaceOption = { id: number; name: string };

type Entry = {
  userId: string;
  userName: string;
  driver1: string;
  driver2: string;
  team: string;
  strategy: string;
  drsTarget: string | null;
  drsTargetName: string | null;
  huileMoteurTarget: string | null;
  score: number | null;
  breakdown: string | null;
};

type RecapData = {
  race: { id: number; name: string; round: number; location: string; date: string; hasSprint: boolean };
  entries: Entry[];
};

type Props = {
  races: RaceOption[];
  initialRecap: RecapData;
  currentUserId: string;
};

export default function RaceRecapSelector({ races, initialRecap, currentUserId }: Props) {
  const [selectedId, setSelectedId] = useState(initialRecap.race.id);
  const [recap, setRecap] = useState<RecapData>(initialRecap);
  const [loading, setLoading] = useState(false);

  async function handleChange(id: number) {
    setSelectedId(id);
    if (id === recap.race.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/races/recap?raceId=${id}`);
      if (res.ok) {
        const data = await res.json();
        setRecap(data);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-gray-400 text-sm shrink-0">GP :</span>
        <select
          value={selectedId}
          onChange={(e) => handleChange(Number(e.target.value))}
          className="flex-1 bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-yellow-500 cursor-pointer"
        >
          {races.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 text-center text-gray-500 text-sm">
          Chargement…
        </div>
      ) : (
        <LastRaceRecap
          race={{ ...recap.race, date: new Date(recap.race.date) }}
          entries={recap.entries}
          currentUserId={currentUserId}
        />
      )}
    </div>
  );
}
