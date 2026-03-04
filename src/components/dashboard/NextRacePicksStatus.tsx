import { DRIVERS, STRATEGIES } from "@/lib/constants";

type PickSummary = {
  userId: string;
  driver1: string;
  driver2: string;
  team: string;
  strategy: string;
  drsTarget: string | null;
} | null;

type Entry = {
  id: string;
  name: string;
  hasPick: boolean;
  isCurrentUser: boolean;
  pick: PickSummary;
};

type Props = {
  raceName: string;
  deadline: string; // ISO string
  deadlinePassed: boolean;
  entries: Entry[];
};

function driverName(code: string) {
  return DRIVERS.find((d) => d.code === code)?.name ?? code;
}

function strategyLabel(code: string) {
  return STRATEGIES.find((s) => s.code === code)?.label ?? code;
}

function strategyColor(code: string) {
  const color = STRATEGIES.find((s) => s.code === code)?.color ?? "gray";
  const map: Record<string, string> = {
    red:    "bg-red-900/40 text-red-300 border-red-700/50",
    yellow: "bg-yellow-900/40 text-yellow-300 border-yellow-700/50",
    gray:   "bg-gray-800 text-gray-400 border-gray-600/50",
    white:  "bg-gray-700 text-gray-200 border-gray-500/50",
    orange: "bg-orange-900/40 text-orange-300 border-orange-700/50",
    blue:   "bg-blue-900/40 text-blue-300 border-blue-700/50",
    purple: "bg-purple-900/40 text-purple-300 border-purple-700/50",
    green:  "bg-green-900/40 text-green-300 border-green-700/50",
  };
  return map[color] ?? map.gray;
}

export default function NextRacePicksStatus({ raceName, deadline, deadlinePassed, entries }: Props) {
  const validatedCount = entries.filter((e) => e.hasPick).length;
  const deadlineDate = new Date(deadline);
  const deadlineStr = deadlineDate.toLocaleString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
      <div className="flex items-start justify-between mb-4 gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">
            {deadlinePassed ? "Paris du week-end" : "Paris déposés"}
          </h2>
          <p className="text-gray-500 text-xs mt-0.5">
            {raceName}
            {!deadlinePassed && (
              <> · deadline {deadlineStr}</>
            )}
          </p>
        </div>
        <span className="text-sm text-gray-400 shrink-0">
          {validatedCount}/{entries.length}
        </span>
      </div>

      {/* Avant deadline : grille ✓ / ✗ */}
      {!deadlinePassed && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {[...entries]
            .sort((a, b) => {
              if (a.hasPick !== b.hasPick) return a.hasPick ? -1 : 1;
              return a.name.localeCompare(b.name);
            })
            .map((entry) => (
              <div
                key={entry.id}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${
                  entry.hasPick
                    ? "bg-green-950/40 border-green-800/50"
                    : "bg-gray-800/40 border-gray-700/50"
                } ${entry.isCurrentUser ? "ring-1 ring-red-700" : ""}`}
              >
                <span className={`text-base leading-none ${entry.hasPick ? "text-green-400" : "text-gray-600"}`}>
                  {entry.hasPick ? "✓" : "✗"}
                </span>
                <span className={`truncate ${entry.isCurrentUser ? "text-white font-medium" : "text-gray-300"}`}>
                  {entry.name}
                </span>
              </div>
            ))}
        </div>
      )}

      {/* Après deadline : tableau des paris */}
      {deadlinePassed && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs border-b border-gray-800">
                <th className="text-left py-2 pr-4 font-medium">Joueur</th>
                <th className="text-left py-2 pr-4 font-medium">Pilote 1</th>
                <th className="text-left py-2 pr-4 font-medium">Pilote 2</th>
                <th className="text-left py-2 pr-4 font-medium">Écurie</th>
                <th className="text-left py-2 font-medium">Stratégie</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {[...entries]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((entry) => (
                  <tr
                    key={entry.id}
                    className={entry.isCurrentUser ? "bg-gray-800/30" : ""}
                  >
                    <td className="py-2.5 pr-4">
                      <span className={entry.isCurrentUser ? "text-white font-medium" : "text-gray-300"}>
                        {entry.name}
                      </span>
                    </td>
                    {entry.pick ? (
                      <>
                        <td className="py-2.5 pr-4">
                          <span className="font-mono font-bold text-gray-200 text-xs">{entry.pick.driver1}</span>
                          <span className="text-gray-500 text-xs ml-1.5">{driverName(entry.pick.driver1).split(" ").pop()}</span>
                        </td>
                        <td className="py-2.5 pr-4">
                          <span className="font-mono font-bold text-gray-200 text-xs">{entry.pick.driver2}</span>
                          <span className="text-gray-500 text-xs ml-1.5">{driverName(entry.pick.driver2).split(" ").pop()}</span>
                        </td>
                        <td className="py-2.5 pr-4 text-gray-300 text-xs">{entry.pick.team}</td>
                        <td className="py-2.5">
                          <span className={`inline-block px-2 py-0.5 rounded border text-xs ${strategyColor(entry.pick.strategy)}`}>
                            {strategyLabel(entry.pick.strategy)}
                          </span>
                        </td>
                      </>
                    ) : (
                      <td colSpan={4} className="py-2.5 text-gray-600 text-xs italic">
                        Pas de pari soumis
                      </td>
                    )}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
