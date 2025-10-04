// src/components/IndicatorModal.tsx
import React, { useEffect, useState } from "react";
import { TF } from "../types";

type Props = {
  tf: TF;
  show: boolean;
  onClose: () => void;
};

export default function IndicatorModal({ tf, show, onClose }: Props) {
  const [maEnabled, setMaEnabled] = useState(true);
  const [maType, setMaType] = useState<"SMA" | "EMA">("EMA");
  const [maLen, setMaLen] = useState(20);

  useEffect(() => {
    if (!show) return;
    // โหลด config ตาม TF ถ้ามี (mock)
    const raw = localStorage.getItem(`indi:${tf}`);
    if (raw) {
      try {
        const j = JSON.parse(raw);
        setMaEnabled(!!j.maEnabled);
        setMaType((j.maType as any) || "EMA");
        setMaLen(Number(j.maLen || 20));
      } catch {}
    }
  }, [show, tf]);

  function save() {
    localStorage.setItem(
      `indi:${tf}`,
      JSON.stringify({ maEnabled, maType, maLen })
    );
    onClose();
  }

  if (!show) return null;

  return (
    <div className="modal d-block" tabIndex={-1} role="dialog" style={{ background: "rgba(0,0,0,.5)" }}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content bg-dark text-light">
          <div className="modal-header">
            <h5 className="modal-title">Indicator Params — {tf}</h5>
            <button className="btn btn-sm btn-outline-light" onClick={onClose}>×</button>
          </div>
          <div className="modal-body">
            <div className="row g-3">
              <div className="col-4">
                <div className="form-check">
                  <input id="maEnabled" className="form-check-input" type="checkbox"
                         checked={maEnabled} onChange={e=>setMaEnabled(e.target.checked)} />
                  <label className="form-check-label" htmlFor="maEnabled">Enable MA</label>
                </div>
              </div>
              <div className="col-4">
                <label className="form-label">MA Type</label>
                <select className="form-select" value={maType} onChange={e=>setMaType(e.target.value as any)}>
                  <option value="SMA">SMA</option>
                  <option value="EMA">EMA</option>
                </select>
              </div>
              <div className="col-4">
                <label className="form-label">Length</label>
                <input type="number" min={1} className="form-control"
                       value={maLen} onChange={e=>setMaLen(Number(e.target.value)||1)} />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={save}>Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}
