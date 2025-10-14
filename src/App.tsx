// src/App.tsx
import { useEffect, useMemo, useState } from "react";
import LicenseBanner from "@components/LicenseBanner";
import LicenseGate from "@components/LicenseGate";
import { LicenseProvider } from "./context/LicenseContext";
import "./styles/app.css";

import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  NavLink,
} from "react-router-dom";

import Home from "@pages/Home";
import AdminPage from "@pages/AdminPage";

function Layout({
  theme,
  setTheme,
  children,
}: {
  theme: "light" | "dark";
  setTheme: (t: "light" | "dark") => void;
  children: React.ReactNode;
}) {
  const appName = useMemo(
    () => import.meta.env.VITE_APP_NAME || "Angel Forecast",
    []
  );
  const apiBaseLabel = useMemo(
    () => import.meta.env.VITE_LICENSE_BASE_URL?.trim() || "/api",
    []
  );

  return (
    <div
      className={`min-h-screen flex flex-col ${
        theme === "dark"
          ? "bg-gray-900 text-gray-100"
          : "bg-white text-gray-900"
      }`}
    >
      {/* แบนเนอร์แจ้งสถานะไลเซนส์ */}
      <LicenseBanner />

      <div className="max-w-5xl mx-auto px-4 py-10 flex-1 w-full grid gap-6">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold">{appName} — License Console</h1>

            {/* เมนูนำทางแบบ “ปุ่ม” */}
            <nav className="text-sm flex gap-2">
              <NavLink
                to="/"
                className={({ isActive }) =>
                  `ab-chip ${isActive ? "active" : ""}`
                }
                end
              >
                Home
              </NavLink>

              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `ab-chip ${isActive ? "active" : ""}`
                }
              >
                Admin
              </NavLink>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-sm opacity-70">
              API: <code>{apiBaseLabel}</code>
            </div>
            <button
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              className="border rounded px-2 py-1 text-xs"
              title={theme === "light" ? "Switch to dark" : "Switch to light"}
            >
              {theme === "light" ? "🌙 Dark" : "☀️ Light"}
            </button>
          </div>
        </header>

        {/* เนื้อหาเพจ */}
        {children}

        {/* Footer */}
        <footer className="pt-6 text-xs opacity-60 text-center">
          © AngelTeam — License System Connected
        </footer>
      </div>
    </div>
  );
}

export default function App() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // sync class บน <body> ให้ธีมทำงาน
  useEffect(() => {
    document.body.classList.remove("light", "dark");
    document.body.classList.add(theme === "dark" ? "dark" : "light");
  }, [theme]);

  return (
    <LicenseProvider>
      <LicenseGate>
        <BrowserRouter>
          <Layout theme={theme} setTheme={setTheme}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </LicenseGate>
    </LicenseProvider>
  );
}
