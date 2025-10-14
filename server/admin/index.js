// C:\AngelBot\server\admin\index.js
const express = require('express');
const rateLimit = require('express-rate-limit');
const { requireAdmin, login, logout, me } = require('./auth');

const router = express.Router();

// rate limit เฉพาะ login
const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 นาที
  max: 20,                 // 20 ครั้ง/หน้าต่างเวลา
  standardHeaders: true,
  legacyHeaders: false,
});

// /admin/login  (POST {username,password})
router.post('/login', loginLimiter, express.json(), login);

// /admin/logout
router.post('/logout', logout);

// /admin/me
router.get('/me', requireAdmin, me);

// ตัวอย่าง protected อื่นๆ
router.get('/stats', requireAdmin, (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

module.exports = router;
