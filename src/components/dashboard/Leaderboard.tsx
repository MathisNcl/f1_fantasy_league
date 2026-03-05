import Link from "next/link";
import { LeaderboardEntry } from "@/types";

type Props = {
  entries: LeaderboardEntry[];
  currentUserId: string;
};

export default function Leaderboard({ entries, currentUserId }: Props) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
      <h2 className="text-xl font-semibold text-white mb-4">Classement</h2>

      {entries.length === 0 ? (
        <p className="text-gray-400 text-sm">
          Aucun score enregistré pour le moment.
        </p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, index) => (
            <Link
              key={entry.userId}
              href={`/joueur/${entry.userId}`}
              className={`flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
                entry.userId === currentUserId
                  ? "bg-red-950 border border-red-800 hover:bg-red-900"
                  : "bg-gray-800 hover:bg-gray-700"
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`text-sm font-bold w-6 text-center ${
                    index === 0
                      ? "text-yellow-400"
                      : index === 1
                      ? "text-gray-300"
                      : index === 2
                      ? "text-orange-400"
                      : "text-gray-500"
                  }`}
                >
                  {index + 1}
                </span>
                <span className="text-white font-medium">{entry.name}</span>
                {entry.userId === currentUserId && (
                  <span className="text-xs text-red-400 font-medium">vous</span>
                )}
              </div>
              <div className="flex items-center gap-4">
                <span className="text-gray-400 text-sm">
                  {entry.pickCount} GP
                </span>
                <span className="text-white font-bold text-lg">
                  {entry.totalPoints} pts
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
