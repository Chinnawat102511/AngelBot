type Row = { symbol:string; time: Date; status: 'Open'|'Close'|'-' ; price:number; trend:'Up'|'Down'|'-' };
type Props = { rows: Row[]; onRefresh?: ()=>void; };
export default function AssetLiveBoard({ rows, onRefresh }: Props) {
  return (
    <div className="rounded-2xl bg-neutral-900/40 p-4">
      <div className="flex items-center mb-2">
        <div className="font-semibold">Asset Live Board</div>
        <div className="ml-auto flex gap-2">
          <button className="rounded-md px-3 py-1 bg-neutral-800" onClick={onRefresh}>Refresh Now</button>
          <button className="rounded-md px-3 py-1 bg-neutral-800">Calibrate Now</button>
        </div>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-neutral-800/70">
          <tr>
            <th className="text-left px-3 py-2">Asset</th>
            <th className="text-left px-3 py-2">Market Time</th>
            <th className="text-left px-3 py-2">Status</th>
            <th className="text-left px-3 py-2">Price</th>
            <th className="text-left px-3 py-2">Trend</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r,i)=>(
            <tr key={i} className="border-b border-neutral-800">
              <td className="px-3 py-2">{r.symbol}</td>
              <td className="px-3 py-2">{r.time.toLocaleTimeString()}</td>
              <td className="px-3 py-2">{r.status}</td>
              <td className="px-3 py-2">{r.price}</td>
              <td className="px-3 py-2">{r.trend}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
