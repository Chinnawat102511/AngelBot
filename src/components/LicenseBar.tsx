type Props = {
  onVerify: (licenseKey: string) => Promise<{ok:boolean; message?:string}>;
};
export default function LicenseBar({ onVerify }: Props) {
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>('');

  return (
    <div className="rounded-2xl bg-neutral-900/40 p-4 flex items-center gap-3">
      <span className="font-semibold">AngelBot UI</span>
      <span className="px-2 py-0.5 rounded bg-emerald-700/30 text-emerald-300 text-xs">Timezone: Asia/Bangkok</span>
      <div className="flex-1" />
      <input
        className="w-[420px] rounded-lg bg-neutral-800 px-3 py-2 outline-none"
        placeholder={`{"license_key":"...", "note":"JSON ก็ได้/ข้อความก็ได้"}`}
        value={key}
        onChange={(e)=>setKey(e.target.value)}
      />
      <button
        className="rounded-lg px-3 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50"
        disabled={busy}
        onClick={async ()=>{
          setBusy(true);
          const r = await onVerify(key);
          setMsg(r.ok ? 'Verified' : (r.message ?? 'Failed'));
          setBusy(false);
        }}
      >Verify</button>
      {msg && <span className="text-xs opacity-70 ml-2">{msg}</span>}
    </div>
  );
}
import { useState } from 'react';
