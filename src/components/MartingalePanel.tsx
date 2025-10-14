type Props = {
  mode: 'Fixed'|'Custom'; base: number; steps: number;
  scope: 'Combined'|'PerAsset'; rule: string; customList: string;
  onChange: (v:Partial<Props>)=>void;
};
export default function MartingalePanel(p: Props) {
  return (
    <div className="rounded-2xl bg-neutral-900/40 p-4 space-y-2">
      <div className="font-semibold">Martingale</div>
      <div className="grid grid-cols-6 gap-2">
        <div>
          <label className="text-xs opacity-70">Mode</label>
          <select className="w-full rounded-lg bg-neutral-800 px-2 py-2" value={p.mode}
            onChange={e=>p.onChange({ mode: e.target.value as any })}>
            <option>Custom</option><option>Fixed</option>
          </select>
        </div>
        <div>
          <label className="text-xs opacity-70">Base</label>
          <input className="w-full rounded-lg bg-neutral-800 px-3 py-2" type="number" value={p.base}
            onChange={e=>p.onChange({ base: Number(e.target.value||0) })}/>
        </div>
        <div>
          <label className="text-xs opacity-70">Steps</label>
          <input className="w-full rounded-lg bg-neutral-800 px-3 py-2" type="number" value={p.steps}
            onChange={e=>p.onChange({ steps: Number(e.target.value||0) })}/>
        </div>
        <div>
          <label className="text-xs opacity-70">Scope</label>
          <select className="w-full rounded-lg bg-neutral-800 px-2 py-2" value={p.scope}
            onChange={e=>p.onChange({ scope: e.target.value as any })}>
            <option>Combined</option><option>PerAsset</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className="text-xs opacity-70">Step rule</label>
          <input className="w-full rounded-lg bg-neutral-800 px-3 py-2" value={p.rule} onChange={e=>p.onChange({ rule: e.target.value })}/>
        </div>
      </div>
      <div className="mt-2">
        <label className="text-xs opacity-70">Custom List (CSV)</label>
        <input className="w-full rounded-lg bg-neutral-800 px-3 py-2" value={p.customList} onChange={e=>p.onChange({ customList: e.target.value })}/>
      </div>
    </div>
  );
}
