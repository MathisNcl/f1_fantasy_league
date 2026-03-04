type Entry = {
  id: string;
  name: string;
  hasPick: boolean;
  isCurrentUser: boolean;
};

type Props = {
  raceName: string;
  entries: Entry[];
};

export default function NextRacePicksStatus({ raceName, entries }: Props) {
  const sorted = [...entries].sort((a, b) => {
    if (a.hasPick !== b.hasPick) return a.hasPick ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const validatedCount = entries.filter((e) => e.hasPick).length;

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Paris déposés</h2>
        <span className="text-sm text-gray-400">
          {raceName} — {validatedCount}/{entries.length}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {sorted.map((entry) => (
          <div
            key={entry.id}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${
              entry.hasPick
                ? "bg-green-950/40 border-green-800/50"
                : "bg-gray-800/40 border-gray-700/50"
            } ${entry.isCurrentUser ? "ring-1 ring-red-700" : ""}`}
          >
            <span
              className={`text-base leading-none ${
                entry.hasPick ? "text-green-400" : "text-gray-600"
              }`}
            >
              {entry.hasPick ? "✓" : "✗"}
            </span>
            <span
              className={`truncate ${
                entry.isCurrentUser ? "text-white font-medium" : "text-gray-300"
              }`}
            >
              {entry.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
