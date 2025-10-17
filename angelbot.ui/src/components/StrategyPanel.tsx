import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Trade } from "../types";

type StrategyKey = "baseline" | "followTrend" | "meanRevert";

type Props = {
  trades: Trade[];
};

type Sim = {
  total: number;
  wins: number;
  loses: number;
  equals: number;
  net: number; // $ รวม
  lastSignal?: "CALL" | "PUT" | null;
};

function fmt(n:number){return n.toLocaleString(undefined,{maximumFractionDigits:2})}
function money(n:number){return (n>=0?"+":"") + "$" + fmt(n)}

export default function StrategyPanel({ trades }: Props) {
  const [strategy, setStrategy] = useState<StrategyKey>("baseline");
  const [mgStep, setMgStep] = useState(0); // ใช้แค่จำลองผล ไม่ไปแตะบอทจริง
  const [amount, setAmount] = useState(10);

  // === กลยุทธ์ (paper) ===
  const decide = useMemo(() => {
    const last = trades[0];            // เทรดล่าสุด
    const last2 = trades[1];           // เทรดก่อนหน้า
    return (k: StrategyKey): "CALL" | "PUT" => {
      if (!last) return "CALL";
      switch(k){
        case "baseline": {
          // สุ่ม 50/50 (ฐาน)
          return Math.random() < 0.5 ? "CALL" : "PUT";
        }
        case "followTrend": {
          // ถ้า 3 ไม้ล่าสุด WIN มากกว่า LOSE → CALL, น้อยกว่า → PUT
          const recent = trades.slice(0, 3);
          const win = recent.filter(t=>t.result==="WIN").length;
          const lose = recent.filter(t=>t.result==="LOSE").length;
          if (win > lose) return "CALL";
          if (win < lose) return "PUT";
          // เสมอ ใช้ทิศทางไม้ล่าสุดเป็นตัวตัดสิน
          return last.direction ?? "CALL";
        }
        case "meanRevert": {
          // ถ้า 2 ไม้ล่าสุดแพ้ติดกัน → กลับทิศ
          if (trades.length >= 2) {
            if (trades[0].result==="LOSE" && trades[1].result==="LOSE") {
              return last.direction==="CALL"?"PUT":"CALL";
            }
          }
          // ถ้าไม้ล่าสุดชนะ → กลับทิศ 1 ไม้ (สวนโมเมนตัม)
          return last.direction==="CALL"?"PUT":"CALL";
        }
      }
    };
  }, [trades]);

  // === จำลองผลย้อนหลังจาก Trade จริง ===
  const sim: Sim = useMemo(() => {
    let total=0, wins=0, loses=0, equals=0, net=0;
    // จำลอง “ถ้ากลยุทธ์เราเลือกทิศนี้” แล้วเทียบกับผลจริงของตลาด
    for (let i = trades.length-1; i >= 0; i--) {
      const t = trades[i];
      const signal = decide(strategy);
      const result = resultIf(signal, t); // ผลเทียบกับทิศ/ผลจริง
      total++;
      if (result==="WIN") { wins++; net += Math.abs(t.result_pl ?? 8); }
      else if (result==="LOSE") { loses++; net -= Math.abs(t.result_pl ?? 10); }
      else { equals++; } // เท่าทุน = 0
    }
    const lastSignal = trades[0] ? decide(strategy) : null;
    return { total, wins, loses, equals, net, lastSignal };
  }, [trades, strategy, decide]);

  // สร้างผล WIN/LOSE จากสัญญาณเทียบกับความจริง:
  function resultIf(signal: "CALL"|"PUT", t: Trade): "WIN"|"LOSE"|"EQUAL" {
    // ใช้ผลจริงของ trade ตัดสิน — ถ้าทิศทางของเรา “ตรงกับ” ทิศทางที่ออกผลชนะของไม้จริง เรานับชนะ
    // heuristic ง่ายๆ:
    if (t.result==="EQUAL") return "EQUAL";
    if (t.result==="WIN") {
      // ถ้าไม้จริงชนะด้วยทิศทาง t.direction → เราสัญญาณตรงทิศ = ชนะ
      return signal===t.direction ? "WIN" : "LOSE";
    } else if (t.result==="LOSE") {
      // ถ้าไม้จริงแพ้ด้วยทิศทาง t.direction → สวนทิศจะชนะ
      return signal!==t.direction ? "WIN" : "LOSE";
    }
    return "EQUAL";
  }

  return (
    <div className="rounded-lg bg-white shadow p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="font-medium">Strategy Sandbox (paper)</div>
        <div className="text-xs opacity-60">ทดลองสัญญาณ ไม่ยุ่งกับบอทจริง</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-2 rounded border bg-slate-50">
          <div className="text-[11px] opacity-70 mb-1">Strategy</div>
          <select value={strategy} onChange={e=>setStrategy(e.target.value as StrategyKey)} className="w-full p-2 rounded border">
            <option value="baseline">Baseline (50/50)</option>
            <option value="followTrend">Follow Trend (3 ไม้ล่าสุด)</option>
            <option value="meanRevert">Mean Revert (สวนเมื่อแพ้/ชนะติด)</option>
          </select>
        </div>

        <div className="p-2 rounded border bg-slate-50">
          <div className="text-[11px] opacity-70 mb-1">Test Amount ($)</div>
          <input type="number" className="w-full p-2 rounded border" value={amount} onChange={e=>setAmount(+e.target.value||0)} />
        </div>

        <div className="p-2 rounded border bg-slate-50">
          <div className="text-[11px] opacity-70 mb-1">MG Step (paper)</div>
          <input type="number" className="w-full p-2 rounded border" value={mgStep} onChange={e=>setMgStep(+e.target.value||0)} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-sm">
        <Box label="Last signal" value={sim.lastSignal ?? "-"} accent={sim.lastSignal==="CALL"?"text-emerald-600":sim.lastSignal==="PUT"?"text-rose-600":""}/>
        <Box label="Total" value={sim.total} />
        <Box label="Wins" value={sim.wins} accent="text-emerald-600" />
        <Box label="Loses" value={sim.loses} accent="text-rose-600" />
        <Box label="Equals" value={sim.equals} />
        <Box label="Win rate" value={sim.total? fmt(sim.wins/sim.total*100)+"%":"0%"} />
        <Box label="Net (paper)" value={money(sim.net)} accent={sim.net>=0?"text-emerald-600":"text-rose-600"} />
      </div>

      <div className="text-xs opacity-60 mt-2">
        * Paper sim จะ “อ่านผลจริง” แล้วประเมินว่าถ้าใช้กลยุทธ์นี้ ณ ตอนนั้น เราจะชนะ/แพ้กี่ไม้ — ไม่มีการส่งออเดอร์จริง
      </div>
    </div>
  );
}

function Box({label, value, accent}:{label:string; value:React.ReactNode; accent?:string}){
  return (
    <div className="p-2 rounded border bg-slate-50">
      <div className="text-[11px] opacity-70">{label}</div>
      <div className={`text-base font-semibold ${accent??""}`}>{value}</div>
    </div>
  );
}
