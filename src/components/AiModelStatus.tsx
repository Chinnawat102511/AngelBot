type Props = {
  version: string; accuracy: number; winRate: number; lr: number;
  autoRetrain: boolean;
  onRetrain: ()=>void|Promise<void>;
  onCalibrate: ()=>void|Promise<void>;
};
export default function AiModelStatus(p: Props) {
  return (
    <div className="rounded-2xl bg-neutral-900/40 p-4 space-y-2">
      <div className="flex items-center gap-2">
        <div className="font-semibold">AI Model Status</div>
        <span className="text-xs opacity-60">v{p.version}</span>
        <div className="ml-auto flex gap-2">
          <button className="rounded-md px-3 py-1 bg-neutral-800" onClick={p.onRetrain}>Retrain Now</button>
          <button className="rounded-md px-3 py-1 bg-neutral-800" onClick={p.onCalibrate}>Calibrate Now</button>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2 text-sm">
        <div>Accuracy: <b>{p.accuracy.toFixed(1)}%</b></div>
        <div>Win rate: <b>{p.winRate.toFixed(1)}%</b></div>
        <div>LR: <b>{p.lr.toFixed(4)}</b></div>
        <div>Auto Retrain: <b>{p.autoRetrain ? 'On':'Off'}</b></div>
      </div>
      <div className="text-xs opacity-60">(* ตัวเลขเป็น placeholder — ผูก endpoint ได้ภายหลัง)</div>
    </div>
  );
}
