// C:\AngelBot\angelbot.ui\src\components\LicensePanel.tsx
import React from "react";
import {
  generate,
  verify,
  pingForecast,
  getStatus,
  getActivePath,
  setActivePath,
} from "../lib/license";
import { useLicenseStatus } from "../lib/license";

export default function LicensePanel() {
  const [s, refresh] = useLicenseStatus();
  const [team, setTeam] = React.useState("AngelTeam");
  const [days, setDays] = React.useState(30);
  const [log, setLog] = React.useState<any>({});

  // สำหรับปุ่ม Choose File
  const fileRef = React.useRef<HTMLInputElement | null>(null);
  const [selectedName, setSelectedName] = React.useState<string | null>(null);

  async function doGenerate() {
    const r = await generate(team, days);
    setLog(r);
    await refresh();
  }

  async function doVerify(p?: string) {
    const r = await verify(p);
    setLog(r);
    await refresh();
  }

  async function doPing() {
    const r = await pingForecast();
    setLog(r);
  }

  async function doRefresh() {
    const r = await getStatus();
    setLog(r);
    await refresh();
  }

  function onFileChosen() {
    // ยังไม่เชื่อมต่อจนกด "Connect"
    const f = fileRef.current?.files?.[0] || null;
    setSelectedName(f ? f.name : null);
    if (f) setLog({ note: "File selected", name: f.name, size: f.size });
  }

  async function onConnect() {
    // หมายเหตุ: เบราเซอร์ไม่เปิดเผย full path ของไฟล์ที่เลือกด้วย <input type="file">
    // เราจึงยืนยัน/ใช้ active path ปัจจุบัน (หรือ path ที่ตั้งค่าผ่านระบบ) แล้ว verify
    const p = getActivePath();
    setActivePath(p);
    await doVerify(p);
  }

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="mb-2 text-xs text-slate-500">
        HomeAdminAPI: <code>http://localhost:3001</code>
      </div>
      <div className="mb-4 text-xs text-slate-500">
        Current File: <code>{s?.path || getActivePath()}</code>
      </div>

      <div className="grid grid-cols-12 gap-3">
        <input
          className="col-span-5 rounded border px-3 py-2"
          value={team}
          onChange={(e) => setTeam(e.target.value)}
          placeholder="Team name"
        />
        <input
          className="col-span-2 rounded border px-3 py-2"
          type="number"
          value={days}
          onChange={(e) => setDays(parseInt(e.target.value || "0", 10))}
          placeholder="Days"
        />
        <button
          className="col-span-5 rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
          onClick={doGenerate}
        >
          Generate
        </button>

        {/* แถวปุ่ม Choose/Connect/Verify/Ping/Refresh */}
        <div className="col-span-12 flex flex-wrap items-center gap-2">
          {/* input file แบบซ่อน */}
          <input
            id="licenseFile"
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={onFileChosen}
          />

          {/* ปุ่ม Choose File (ชัด ๆ คลิกได้แน่) */}
          <label
            htmlFor="licenseFile"
            className="inline-flex cursor-pointer select-none items-center rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            title="เลือกไฟล์ไลเซนส์ (.json)"
          >
            Choose File
          </label>

          {/* แสดงชื่อไฟล์ที่เลือก */}
          <span className="text-sm text-slate-500 min-w-[12ch]">
            {selectedName ? selectedName : "No file chosen"}
          </span>

          {/* ปุ่ม Connect → ยืนยัน active path + verify */}
          <button
            className="rounded bg-emerald-600 px-3 py-2 text-white hover:bg-emerald-700"
            onClick={onConnect}
            title="ยืนยันการเชื่อมต่อไฟล์ที่ใช้งาน (active path)"
          >
            Connect
          </button>

          <button
            className="rounded bg-emerald-700 px-3 py-2 text-white hover:bg-emerald-800"
            onClick={() => doVerify()}
          >
            Verify
          </button>

          <button
            className="rounded bg-slate-700 px-3 py-2 text-white hover:bg-slate-800"
            onClick={doPing}
          >
            Ping Forecast
          </button>

          <button
            className="rounded bg-slate-500 px-3 py-2 text-white hover:bg-slate-600"
            onClick={doRefresh}
          >
            Refresh
          </button>
        </div>
      </div>

      <pre className="mt-4 max-h-64 overflow-auto rounded bg-[#0b1220] p-3 text-[12px] text-[#b8c1d7]">
        {JSON.stringify(log, null, 2)}
      </pre>
    </div>
  );
}
