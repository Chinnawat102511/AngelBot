type Props = {
  loadTime: number; trend: 'Strict'|'Normal'|'Off'; micro: 'On'|'Off';
  onChange: (v:{loadTime:number;trend:Props['trend'];micro:Props['micro']; timeWindow?:string})=>void;
};
export default function FiltersPanel({ loadTime, trend, micro, onChange }: Props) {
  return (
    <div className="rounded-2xl bg-neutral-900/40 p-4 space-y-2">
      <div className="font-semibold">Filters</div>
      <div className="grid grid-cols-4 gap-2">
        <div>
          <label className="text-xs opacity-70">Load Time (s)</label>
          <input className="w-full rounded-lg bg-neutral-800 px-3 py-2" type="number" value={loadTime}
            onChange={e=>onChange({ loadTime:Number(e.target.value||0), trend, micro })}/>
        </div>
        <div>
          <label className="text-xs opacity-70">Trend Filter</label>
          <select className="w-full rounded-lg bg-neutral-800 px-2 py-2" value={trend}
            onChange={e=>onChange({ loadTime, trend: e.target.value as any, micro })}>
              <option>Strict</option><option>Normal</option><option>Off</option>
          </select>
        </div>
        <div>
          <label className="text-xs opacity-70">Micro Sec</label>
          <select className="w-full rounded-lg bg-neutral-800 px-2 py-2" value={micro}
            onChange={e=>onChange({ loadTime, trend, micro: e.target.value as any })}>
              <option>On</option><option>Off</option>
          </select>
        </div>
        <div>
          <label className="text-xs opacity-70">Time Window (CSV "HH:MM-HH:MM")</label>
          <input className="w-full rounded-lg bg-neutral-800 px-3 py-2"
            onChange={e=>onChange({ loadTime, trend, micro, timeWindow: e.target.value })}/>
        </div>
      </div>
    </div>
  );
}
