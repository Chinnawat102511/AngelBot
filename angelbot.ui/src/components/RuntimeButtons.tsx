import { useState } from "react";
import { request } from "../api"; // มี helper เดิมอยู่แล้ว

export default function RuntimeButtons() {
  const [busy, setBusy] = useState(false);

  const hit = (path: string) => async () => {
    setBusy(true);
    try { await request(path, { method: "POST" } as any); }
    finally { setBusy(false); }
  };

  return (
    <div className="flex gap-2">
      <button onClick={hit("/bot/pause")}  disabled={busy} className="px-3 py-1 bg-yellow-500 text-white rounded">Pause</button>
      <button onClick={hit("/bot/resume")} disabled={busy} className="px-3 py-1 bg-blue-600 text-white rounded">Resume</button>
      <button onClick={hit("/api/reset")}  disabled={busy} className="px-3 py-1 bg-red-600 text-white rounded">Reset data</button>
      <a className="px-3 py-1 bg-black text-white rounded" href="/api/trades.csv">Export CSV</a>
    </div>
  );
}
