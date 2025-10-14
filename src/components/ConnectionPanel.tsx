import { useState } from 'react';

type Props = {
  connected: boolean;
  balance: number;
  accountType: string;
  busy?: boolean;
  onConnect: (email:string, password:string, type:'PRACTICE'|'LIVE')=>Promise<void>|void;
};
export default function ConnectionPanel({ connected, balance, accountType, busy, onConnect }: Props) {
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const [type, setType] = useState<'PRACTICE'|'LIVE'>(accountType as any || 'PRACTICE');

  return (
    <div className="rounded-2xl bg-neutral-900/40 p-4">
      <div className="flex items-center gap-3">
        <input className="flex-1 rounded-lg bg-neutral-800 px-3 py-2" placeholder="email" value={email} onChange={e=>setEmail(e.target.value)} />
        <input className="w-64 rounded-lg bg-neutral-800 px-3 py-2" placeholder="password" type="password" value={pwd} onChange={e=>setPwd(e.target.value)} />
        <select className="rounded-lg bg-neutral-800 px-2 py-2" value={type} onChange={e=>setType(e.target.value as any)}>
          <option value="PRACTICE">PRACTICE</option>
          <option value="LIVE">LIVE</option>
        </select>
        <button
          className={`rounded-lg px-3 py-2 ${connected ? 'bg-emerald-700' : 'bg-emerald-600 hover:bg-emerald-500'} disabled:opacity-50`}
          disabled={busy}
          onClick={()=>onConnect(email, pwd, type)}
        >
          {connected ? 'Connected' : 'Connect'}
        </button>
        <div className="ml-auto text-xs opacity-80">Balance: {balance.toLocaleString()} {type}</div>
      </div>
    </div>
  );
}
