// --- components/AssetChips.tsx ---
import React from "react";

const UNIVERSE = [
  "XAUUSD", "EURJPY", "EURUSD", "AUDUSD", "USDJPY", "EURGBP", "GBPUSD",
  "XAUUSD-OTC", "EURJPY-OTC", "EURUSD-OTC", "AUDUSD-OTC", "USDJPY-OTC", "EURGBP-OTC", "GBPUSD-OTC",
];

export function AssetChips({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const set = new Set(value);

  function toggle(a: string) {
    const next = new Set(set);
    if (next.has(a)) next.delete(a);
    else next.add(a);
    const arr = Array.from(next);
    onChange(arr.length ? arr : ["EURUSD"]); // default ถ้าไม่ได้เลือกอะไร
  }

  return (
    <div className="d-flex flex-wrap gap-2">
      {UNIVERSE.map((a) => (
        <span
          key={a}
          role="button"
          className={`badge-chip ${set.has(a) ? "active" : ""}`}
          onClick={() => toggle(a)}
          title={a}
        >
          {a}
        </span>
      ))}
    </div>
  );
}
