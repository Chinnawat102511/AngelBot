import React, { useEffect, useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  tf: "1m"|"5m";
  value: { ai:{conf:number;gap:number}; mbf:{conf:number;gap:number} };
  onSave: (v: { ai:{conf:number;gap:number}; mbf:{conf:number;gap:number} }) => void;
};

export default function ThresholdsModal({ open, onClose, tf, value, onSave }: Props){
  const [ai, setAi] = useState(value.ai);
  const [mbf, setMbf] = useState(value.mbf);

  useEffect(()=>{ setAi(value.ai); setMbf(value.mbf); }, [value, open]);

  if (!open) return null;

  function slider(label:string, v:number, set:(n:number)=>void) {
    return (
      <div className="mb-3">
        <div className="d-flex justify-content-between">
          <div className="fw-semibold">{label}</div>
          <span className="text-info">{v.toFixed(2)}</span>
        </div>
        <input type="range" min={0} max={1} step={0.01} value={v} onChange={e=>set(parseFloat(e.target.value))} className="form-range" />
      </div>
    );
  }

  return (
    <div className="modal d-block" tabIndex={-1} style={{background:"rgba(0,0,0,.6)"}}>
      <div className="modal-dialog">
        <div className="modal-content bg-dark text-light">
          <div className="modal-header">
            <h5 className="modal-title">Thresholds — {tf}</h5>
            <button className="btn btn-sm btn-outline-light" onClick={onClose}>×</button>
          </div>
          <div className="modal-body">
            <div className="border rounded p-3 mb-3">
              <div className="h6">AI</div>
              {slider("Confidence", ai.conf, v=>setAi({...ai, conf:v}))}
              {slider("Gap",        ai.gap,  v=>setAi({...ai, gap:v}))}
            </div>
            <div className="border rounded p-3">
              <div className="h6">MBF</div>
              {slider("Confidence", mbf.conf, v=>setMbf({...mbf, conf:v}))}
              {slider("Gap",        mbf.gap,  v=>setMbf({...mbf, gap:v}))}
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline-light" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={()=>onSave({ai,mbf})}>Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}
