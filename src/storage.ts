// --- storage.ts ---
export function saveByEmail(email: string, key: string, obj: any) {
  try {
    const k = nsKey(email, key);
    localStorage.setItem(k, JSON.stringify(obj));
  } catch {}
}
export function loadByEmail<T>(email: string, key: string, fallback: T): T {
  try {
    const k = nsKey(email, key);
    const raw = localStorage.getItem(k);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) };
  } catch {
    return fallback;
  }
}
function nsKey(email: string, key: string) {
  const e = (email || "guest").toLowerCase().trim();
  return `angelbot:${e}:${key}`;
}
