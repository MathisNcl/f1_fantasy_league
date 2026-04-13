"use client";

import { useRouter } from "next/navigation";

type Player = { id: string; name: string; totalPoints: number };

export default function PlayerSwitcher({
  players,
  currentId,
}: {
  players: Player[];
  currentId: string;
}) {
  const router = useRouter();

  return (
    <select
      value={currentId}
      onChange={(e) => router.push(`/joueur/${e.target.value}`)}
      className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-yellow-500 cursor-pointer"
    >
      {players.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name} — {p.totalPoints} pts
        </option>
      ))}
    </select>
  );
}
