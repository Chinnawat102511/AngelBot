import express from "express";
import { checkLicense, startLicenseScheduler } from "./license-client.js";

const app = express();

// เรียกตอนสตาร์ท
startLicenseScheduler();

// middleware บังคับตรวจทุก request (ปรับได้ตามความเข้มงวด)
app.use(async (req, res, next) => {
  const ver = await checkLicense();
  if (!ver.ok) {
    return res.status(403).json({ ok: false, error: "license_invalid", details: ver });
  }
  next();
});

app.get("/demo", (_req, res) => res.json({ ok: true, msg: "service works" }));

app.listen(5050, () => console.log("Client app on http://localhost:5050"));
