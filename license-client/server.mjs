// C:\AngelBot\license-client\server.mjs
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
app.use(cors());
app.use(morgan('dev'));

// พอร์ต License Server (ดีฟอลต์ 3001)
const PORT = Number(process.env.LICENSE_PORT || 3001);

// จำลองค่า Config
const CONFIG = {
  PORT,
  REFRESH_INTERVAL_MIN: Number(process.env.REFRESH_INTERVAL_MIN || 1),
  ALLOW_ORIGIN: process.env.ALLOW_ORIGIN?.split(',') || ['*'],
};

// จำลอง License Server: /api/forecast/ping
app.get('/api/forecast/ping', (_req, res) => {
  res.status(200).json({ ok: true, pong: true, t: Date.now() });
});

// log เพื่อ debug
app.get('/api/forecast/status', (_req, res) => {
  res.json({ ok: true, config: CONFIG, time: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`License server running on http://localhost:${PORT}`);
  console.log(`Config:`, CONFIG);
});
