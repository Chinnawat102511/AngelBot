type Props = { selected: string[]; onChange: (symbols:string[])=>void; };
export default function AssetsSelector({ selected, onChange }: Props) {
  const all = ['KAUUSD','EURJPY','EURUSD','AUDUSD','GBPUSD','USDJPY','EURUSD-OTC','GBPUSD-OTC'];
  return (
    <div className="rounded-2xl bg-neutral-900/40 p-4">
      <div className="text-sm mb-2">Assets</div>
      <div className="flex flex-wrap gap-2">
        {all.map(sym=>{
          const on = selected.includes(sym);
          return (
            <button key={sym}
              onClick={()=> onChange(on ? selected.filter(s=>s!==sym) : [...selected, sym])}
              className={`px-3 py-1 rounded-full text-xs ${on?'bg-emerald-700':'bg-neutral-800'}`}>
              {sym}
            </button>
          );
        })}
      </div>
    </div>
  );
}
