"use client";

import { useEffect, useRef, useState } from "react";
import { DRIVERS } from "@/lib/constants";

type Props = {
  value: string;
  onChange: (code: string) => void;
  /** Clé = code pilote, valeur = énergie 0.0–1.0 */
  energyMap: Record<string, number>;
  /** Code pilote à exclure (l'autre pilote déjà sélectionné) */
  excludeCode?: string;
  disabled?: boolean;
  placeholder?: string;
};

function energyColorClass(pct: number): string {
  if (pct >= 80) return "text-green-400 bg-green-900/40 border-green-700/50";
  if (pct >= 60) return "text-yellow-400 bg-yellow-900/40 border-yellow-700/50";
  if (pct >= 40) return "text-orange-400 bg-orange-900/40 border-orange-700/50";
  return "text-red-400 bg-red-900/40 border-red-700/50";
}

function EnergyBadge({ pct }: { pct: number }) {
  return (
    <span
      className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded border ${energyColorClass(pct)}`}
    >
      ⚡{pct}%
    </span>
  );
}

export default function DriverSelect({
  value,
  onChange,
  energyMap,
  excludeCode,
  disabled,
  placeholder = "Choisir un pilote...",
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selected = DRIVERS.find((d) => d.code === value);
  const selectedPct = selected ? Math.round((energyMap[selected.code] ?? 1) * 100) : 0;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          if (!disabled) setOpen((o) => !o);
        }}
        disabled={disabled}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-left text-sm flex items-center justify-between gap-2 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:border-yellow-500 transition-colors hover:border-gray-600"
      >
        {selected ? (
          <span className="flex items-center gap-2 min-w-0">
            <span className="text-white font-medium truncate">{selected.name}</span>
            <span className="text-gray-400 text-xs shrink-0">({selected.team})</span>
            <EnergyBadge pct={selectedPct} />
          </span>
        ) : (
          <span className="text-gray-500">{placeholder}</span>
        )}
        <svg
          className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 20 20"
        >
          <path
            stroke="currentColor"
            strokeWidth="1.5"
            d="M6 8l4 4 4-4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-64 overflow-y-auto">
          {DRIVERS.filter((d) => d.code !== excludeCode).map((d) => {
            const pct = Math.round((energyMap[d.code] ?? 1) * 100);
            const isSelected = d.code === value;
            return (
              <button
                key={d.code}
                type="button"
                onClick={() => {
                  onChange(d.code);
                  setOpen(false);
                }}
                className={`w-full px-3 py-2 flex items-center justify-between gap-2 text-left transition-colors ${
                  isSelected
                    ? "bg-gray-700"
                    : "hover:bg-gray-700/60"
                }`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className="font-mono font-bold text-gray-200 text-xs w-8 shrink-0">
                    {d.code}
                  </span>
                  <span className="text-white text-sm truncate">{d.name}</span>
                  <span className="text-gray-500 text-xs shrink-0 hidden sm:inline">
                    {d.team}
                  </span>
                </span>
                <EnergyBadge pct={pct} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
