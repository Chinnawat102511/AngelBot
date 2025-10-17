import React, { useState } from 'react';

type Props = {
  onConnected?: () => void;
};

export default function ConnectPanel({ onConnected }: Props) {
  const [email, setEmail] = useState('demo@angel.team');
  const [password, setPassword] = useState('secret');
  const [accountType, setAccountType] = useState<'PRACTICE' | 'REAL'>('PRACTICE');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string>('');

  const connect = async () => {
    try {
      setLoading(true);
      setMsg('');
      const r = await fetch('/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, account_type: accountType }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.message || `connect ${r.status}`);
      setMsg('Connected ✓');
      onConnected?.();
    } catch (e: any) {
      setMsg(e?.message || 'Connect failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3 text-sm font-medium text-gray-700">Connect</div>
      <div className="grid gap-3 sm:grid-cols-3">
        <input
          className="rounded-md border px-3 py-2"
          placeholder="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="rounded-md border px-3 py-2"
          placeholder="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <select
          className="rounded-md border px-3 py-2"
          value={accountType}
          onChange={(e) => setAccountType(e.target.value as any)}
        >
          <option value="PRACTICE">PRACTICE</option>
          <option value="REAL">REAL</option>
        </select>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={connect}
          disabled={loading}
          className="rounded-md bg-emerald-600 px-3 py-2 text-white disabled:opacity-50"
        >
          {loading ? 'Connecting…' : 'Connect'}
        </button>
        {msg && <div className="text-sm text-gray-600">{msg}</div>}
      </div>
    </div>
  );
}
