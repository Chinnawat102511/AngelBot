// ESM: C:\AngelBot\server\admin\auth.js
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

/** อายุคุกกี้ 7 วัน (ms) */
const COOKIE_MAX_AGE = 7 * 24 * 3600 * 1000;

/* -------------------- utils & config -------------------- */
const bool = (v) => String(v ?? "").trim().toLowerCase() === "true";

/** อ่านค่า config จาก .env พร้อม trim กันอักขระเกิน */
function getConf() {
  const ADMIN_USER = String(process.env.ADMIN_USER ?? "admin").trim();
  const ADMIN_PASS_HASH = String(process.env.ADMIN_PASS_HASH ?? "").trim();
  const ADMIN_JWT_SECRET = String(process.env.ADMIN_JWT_SECRET ?? "dev_secret").trim();
  const COOKIE_NAME = String(process.env.SESSION_COOKIE_NAME ?? "angelbot_admin").trim();
  const COOKIE_SECURE = bool(process.env.SESSION_COOKIE_SECURE ?? "false");
  return { ADMIN_USER, ADMIN_PASS_HASH, ADMIN_JWT_SECRET, COOKIE_NAME, COOKIE_SECURE };
}

const send401 = (res) => res.status(401).json({ ok: false, error: "unauthorized" });
const send400 = (res, msg = "bad_request") => res.status(400).json({ ok: false, error: msg });
const send500 = (res, msg = "internal_error") => res.status(500).json({ ok: false, error: msg });

/** ออกโทเคน (หมดอายุ 7 วัน) */
function signSession(payload, secret) {
  return jwt.sign(payload, secret, { expiresIn: "7d" });
}

/** เซ็ตคุกกี้ session */
function setCookie(res, name, token, secure) {
  res.cookie(name, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

/** ล้างคุกกี้ session */
function clearCookie(res, name) {
  res.clearCookie(name, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

/** ดึง Bearer token จาก header (ถ้ามี) */
function getBearerToken(req) {
  const h = req.headers?.authorization;
  if (!h || typeof h !== "string") return null;
  const [scheme, token] = h.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token.trim();
}

/* ---------------- middlewares & handlers ---------------- */

/**
 * ตรวจสิทธิ์แอดมิน:
 * - รับ token จาก Cookie (ค่าใน COOKIE_NAME) หรือ Authorization: Bearer
 * - verify ด้วย ADMIN_JWT_SECRET
 * - บังคับ role = 'admin' หรือ u ตรงกับ ADMIN_USER
 */
export function requireAdmin(req, res, next) {
  const { COOKIE_NAME, ADMIN_JWT_SECRET, ADMIN_USER } = getConf();

  // 1) ลองจากคุกกี้ก่อน
  let token = req.cookies?.[COOKIE_NAME];

  // 2) ถ้าไม่มีคุกกี้ ลองจาก Bearer token
  if (!token) token = getBearerToken(req);

  if (!token) return send401(res);

  try {
    const data = jwt.verify(token, ADMIN_JWT_SECRET);
    const isAdmin = data?.role === "admin" || data?.u === ADMIN_USER;
    if (!isAdmin) return send401(res);

    req.admin = data; // { u, role, iat, exp }
    next();
  } catch {
    return send401(res);
  }
}

/**
 * POST /admin/login
 * body: { username, password }
 * - username ต้องตรง ADMIN_USER
 * - password จะ compare กับ ADMIN_PASS_HASH (bcrypt)
 * - สำเร็จ: เซ็ตคุกกี้ + ส่ง { ok:true, user }
 */
export async function login(req, res) {
  const c = getConf();
  try {
    const username = String(req.body?.username ?? "").trim();
    const password = String(req.body?.password ?? "");

    // แยก 400 (ฟิลด์ไม่ครบ) และ 401 (ยืนยันตัวตนไม่ผ่าน)
    if (!username || !password) return send400(res, "missing_cred");
    if (username !== c.ADMIN_USER) return send401(res);
    if (!c.ADMIN_PASS_HASH) return send500(res, "server_not_configured");

    // ป้องกัน hash มีอักขระเกิน: ต้องยาวประมาณ 60
    const hash = c.ADMIN_PASS_HASH;
    if (hash.length < 50 || hash.length > 100) return send500(res, "server_not_configured");

    const ok = await bcrypt.compare(password, hash);
    if (!ok) return send401(res);

    const token = signSession({ u: c.ADMIN_USER, role: "admin" }, c.ADMIN_JWT_SECRET);
    setCookie(res, c.COOKIE_NAME, token, c.COOKIE_SECURE);

    return res.json({ ok: true, user: c.ADMIN_USER });
  } catch (e) {
    return send500(res);
  }
}

/** POST /admin/logout */
export function logout(_req, res) {
  clearCookie(res, getConf().COOKIE_NAME);
  return res.json({ ok: true });
}

/** GET /admin/me */
export function me(req, res) {
  if (!req.admin) return send401(res);
  const { u, exp, iat, role } = req.admin;
  return res.json({ ok: true, user: u, role: role ?? "admin", iat, exp });
}
