module.exports = function ensureJson(req, res, next) {
  if (req.method !== 'GET' && !req.is('application/json')) {
    return res.status(415).json({ ok: false, error: 'Content-Type must be application/json' });
  }
  next();
};
