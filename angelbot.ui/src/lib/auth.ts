// src/lib/auth.ts
type Role = "admin" | "user";
const LS_KEY = "ab_auth";

export type AuthState = {
  username: string;
  role: Role;
};

export function getAuth(): AuthState | null {
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthState;
  } catch {
    return null;
  }
}

export function setAuth(auth: AuthState) {
  localStorage.setItem(LS_KEY, JSON.stringify(auth));
}

export function clearAuth() {
  localStorage.removeItem(LS_KEY);
}

// mock login ชั่วคราว: ถ้า username เริ่มด้วย "admin" → role=admin, นอกนั้น user
export async function login(username: string, password: string): Promise<AuthState> {
  // ตรงนี้ภายหลังค่อยเปลี่ยนเป็นเรียก /api/login จริง
  const role: Role = username.toLowerCase().startsWith("admin") ? "admin" : "user";
  const auth = { username, role };
  setAuth(auth);
  return auth;
}
