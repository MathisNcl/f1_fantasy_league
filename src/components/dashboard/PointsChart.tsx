"use client";

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

type PlayerSeries = {
  userId: string;
  name: string;
  color: string;
};

type ChartPoint = {
  raceName: string;
  [userId: string]: string | number;
};

type Props = {
  players: PlayerSeries[];
  data: ChartPoint[];
};

const COLORS = [
  "#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#a855f7",
  "#06b6d4", "#f97316", "#84cc16", "#ec4899", "#14b8a6",
];

export function getPlayerColors(userIds: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  userIds.forEach((id, i) => { map[id] = COLORS[i % COLORS.length]; });
  return map;
}

export default function PointsChart({ players, data }: Props) {
  if (data.length === 0) {
    return (
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 text-center text-gray-500 text-sm">
        Aucune donnée disponible.
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
      <h2 className="text-lg font-semibold text-white mb-6">Évolution des points par GP</h2>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="raceName"
            tick={{ fill: "#9ca3af", fontSize: 11 }}
            tickFormatter={(v: string) => v.replace("Grand Prix", "GP").replace("Grand Prix de", "GP")}
            interval={0}
            angle={-35}
            textAnchor="end"
            height={56}
          />
          <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} width={36} />
          <Tooltip
            contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: 8 }}
            labelStyle={{ color: "#f9fafb", fontWeight: 600, marginBottom: 4 }}
            itemStyle={{ color: "#d1d5db" }}
          />
          <Legend
            wrapperStyle={{ paddingTop: 16 }}
            formatter={(value) => <span style={{ color: "#d1d5db", fontSize: 12 }}>{value}</span>}
          />
          {players.map((p) => (
            <Line
              key={p.userId}
              type="monotone"
              dataKey={p.userId}
              name={p.name}
              stroke={p.color}
              strokeWidth={2}
              dot={{ r: 3, fill: p.color }}
              activeDot={{ r: 5 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
