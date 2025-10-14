// server/mg/routes.js (ESM)
import { Router } from "express";
import { getConfig, setConfig, nextMG, resetMG } from "./engine.js";

const r = Router();

r.get("/config", (_req, res) => {
  res.json({ ok: true, config: getConfig() });
});

r.post("/config", (req, res) => {
  const body = req.body || {};
  const c = setConfig(body);
  res.json({ ok: true, config: c });
});

r.post("/next", (req, res) => {
  const body = req.body || {};
  const result = nextMG({ lastResult: body.lastResult ?? null, lastPnl: Number(body.lastPnl ?? 0) });
  res.json(result);
});

r.post("/reset", (_req, res) => {
  const s = resetMG();
  res.json({ ok: true, state: s });
});

export default r;
