type Props = {
  start: string; stop: string; resetAt: string;
  workdays: string[]; skipWeekend: boolean;
  onChange: (v:Props)=>void;
};
export default function SchedulerPanel(p: Props) {
  const WD = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  return (
    <div className="rounded-2xl bg-neutral-900/40 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="font-semibold">Scheduler</div>
        <div className="ml-auto opacity-50 text-xs">—</div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div><label className="text-xs opacity-70">Start</label>
          <input className="w-full rounded-lg bg-neutral-800 px-3 py-2" type="time" value={p.start}
            onChange={e=>p.onChange({...p, start:e.target.value})}/></div>
        <div><label className="text-xs opacity-70">Stop</label>
          <input className="w-full rounded-lg bg-neutral-800 px-3 py-2" type="time" value={p.stop}
            onChange={e=>p.onChange({...p, stop:e.target.value})}/></div>
        <div><label className="text-xs opacity-70">Reset stats at</label>
          <input className="w-full rounded-lg bg-neutral-800 px-3 py-2" type="time" value={p.resetAt}
            onChange={e=>p.onChange({...p, resetAt:e.target.value})}/></div>
      </div>
      <div className="flex items-center gap-2">
        <div className="text-sm">Work days:</div>
        <div className="flex gap-1 flex-wrap">
          {WD.map(d=>{
            const on = p.workdays.includes(d);
            return (
              <button key={d}
                className={`px-2 py-1 rounded ${on?'bg-emerald-700':'bg-neutral-800'}`}
                onClick={()=> p.onChange({...p, workdays: on ? p.workdays.filter(x=>x!==d) : [...p.workdays, d] })}>{d}</button>
            );
          })}
        </div>
        <label className="ml-auto text-sm flex items-center gap-2">
          <input type="checkbox" checked={p.skipWeekend} onChange={e=>p.onChange({...p, skipWeekend: e.target.checked})}/>
          <span>Skip weekend</span>
        </label>
      </div>
    </div>
  );
}
