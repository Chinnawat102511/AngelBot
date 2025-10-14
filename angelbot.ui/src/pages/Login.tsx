import React from "react";
import { useNavigate } from "react-router-dom";
import { login, getAuth } from "../lib/auth";

export default function Login() {
  const nav = useNavigate();
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [msg, setMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    const authed = getAuth();
    if (authed) {
      nav(authed.role === "admin" ? "/admin" : "/trade", { replace: true });
    }
  }, [nav]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      const a = await login(username.trim(), password);
      nav(a.role === "admin" ? "/admin" : "/trade", { replace: true });
    } catch (err: any) {
      setMsg(err?.message || "Login failed");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <form onSubmit={onSubmit} className="w-full max-w-md rounded-xl bg-white p-6 shadow">
        <h1 className="mb-4 text-xl font-semibold">Sign in</h1>
        <div className="mb-3">
          <label className="block text-sm mb-1">Username</label>
          <input
            className="w-full rounded border px-3 py-2"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder='เช่น "admin1" จะได้ role=admin, อื่นๆ = user'
          />
        </div>
        <div className="mb-4">
          <label className="block text-sm mb-1">Password</label>
          <input
            className="w-full rounded border px-3 py-2"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="mock ตอนนี้ยังไม่ตรวจจริง"
          />
        </div>
        {msg && <div className="mb-3 rounded bg-rose-50 px-3 py-2 text-rose-700 text-sm">{msg}</div>}
        <button className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 w-full">
          Login
        </button>
      </form>
    </div>
  );
}
