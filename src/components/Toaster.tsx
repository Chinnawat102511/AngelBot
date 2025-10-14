import { createContext, useCallback, useContext, useMemo, useState } from "react";

type ToastItem = { id: number; text: string; tone?: "ok" | "err" | "info" };
type Ctx = {
  push: (text: string, tone?: ToastItem["tone"]) => void;
};

const ToastCtx = createContext<Ctx | null>(null);

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used inside <ToasterProvider>");
  return ctx;
}

export function ToasterProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((text: string, tone: ToastItem["tone"] = "info") => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs, { id, text, tone }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 2500);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div
        style={{
          position: "fixed", right: 14, bottom: 14, display: "grid", gap: 8, zIndex: 9999,
        }}
      >
        {items.map((t) => (
          <div
            key={t.id}
            className="shadow rounded px-3 py-2 text-sm"
            style={{
              background: t.tone === "ok" ? "#e8fff3"
                       : t.tone === "err" ? "#ffeaea"
                       : "#eef2ff",
              border: "1px solid rgba(0,0,0,.08)",
              color: "#111827",
              minWidth: 220,
            }}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
