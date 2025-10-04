// src/components/SchedulerCard.tsx
import React from "react";

export type Scheduler = {
  start: string;      // "HH:MM"
  stop: string;       // "HH:MM"
  resetAt: string;    // "HH:MM"
  workdays: number[]; // 1..7 (Mon..Sun)
  skipWeekend: boolean;
  enabled: boolean;
};

type Props = { value: Scheduler; onChange: (s: Scheduler) => void };

const dayNames = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

export default function SchedulerCard({ value, onChange }: Props) {
  const v = value;
  const toggleDay = (d: number) => {
    const has = v.workdays.includes(d);
    const next = has ? v.workdays.filter(x=>x!==d) : [...v.workdays, d];
    onChange({ ...v, workdays: next.sort() });
  };

  return (
    <div className="card mb-3">
      <div className="card-header d-flex align-items-center">
        Scheduler
        <div className="form-check form-switch ms-auto">
          <input className="form-check-input" type="checkbox"
                 checked={v.enabled} onChange={e=>onChange({ ...v, enabled: e.target.checked })}/>
        </div>
      </div>
      <div className="card-body">
        <div className="row g-3">
          <div className="col-md-3">
            <label className="form-label">Start</label>
            <input type="time" className="form-control" value={v.start}
                   onChange={e=>onChange({ ...v, start: e.target.value })}/>
          </div>
          <div className="col-md-3">
            <label className="form-label">Stop</label>
            <input type="time" className="form-control" value={v.stop}
                   onChange={e=>onChange({ ...v, stop: e.target.value })}/>
          </div>
          <div className="col-md-3">
            <label className="form-label">Reset stats at</label>
            <input type="time" className="form-control" value={v.resetAt}
                   onChange={e=>onChange({ ...v, resetAt: e.target.value })}/>
          </div>
          <div className="col-md-3">
            <label className="form-label">Options</label>
            <div className="form-check">
              <input id="skipw" className="form-check-input" type="checkbox"
                     checked={v.skipWeekend} onChange={e=>onChange({ ...v, skipWeekend: e.target.checked })}/>
              <label className="form-check-label" htmlFor="skipw">Skip weekend</label>
            </div>
          </div>
          <div className="col-12">
            <label className="form-label">Work days</label><br/>
            {dayNames.map((nm, idx)=> {
              const d = idx+1;
              const active = v.workdays.includes(d);
              return (
                <button key={d} type="button"
                        className={`btn btn-sm me-2 ${active? "btn-primary":"btn-outline-primary"}`}
                        onClick={()=>toggleDay(d)}>
                  {nm}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
