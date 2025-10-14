type KPI = { orders:number; win:number; lose:number; draw:number; maxMg:number; pnl:number };
type Props = { session: KPI; life: KPI };
export default function KPIBoxes({ session, life }: Props) {
  const Box = (title:string, k:KPI) => (
    <div className="rounded-xl bg-neutral-800 p-3 space-y-1">
      <div className="opacity-70 text-xs">{title}</div>
      <div className="grid grid-cols-6 gap-2 text-center">
        <div>Orders<br/><b>{k.orders}</b></div>
        <div>W<br/><b className="text-emerald-400">{k.win}</b></div>
        <div>L<br/><b className="text-rose-400">{k.lose}</b></div>
        <div>D<br/><b className="text-amber-300">{k.draw}</b></div>
        <div>Max MG<br/><b>{k.maxMg}</b></div>
        <div>PnL<br/><b className={k.pnl>=0?'text-emerald-400':'text-rose-400'}>{k.pnl.toFixed(2)}</b></div>
      </div>
    </div>
  );
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {Box('KPI — Session', session)}
      {Box('KPI — Life', life)}
    </div>
  );
}
