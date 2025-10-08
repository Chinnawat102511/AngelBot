// src/App.tsx
import { useEffect, useState } from "react";
import LicenseBanner from "./components/LicenseBanner";
import { LicenseProvider } from "./context/LicenseContext";
import { LicenseGate } from "./components/LicenseGate";

// Router
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  Navigate,
  useLocation,
} from "react-router-dom";

// เพจ
import Home from "./pages/Home";
import AdminPage from "./pages/AdminPage";

function Layout({
  theme,
  setTheme,
  children,
}: {
  theme: "light" | "dark";
  setTheme: (t: "light" | "dark") => void;
  children: React.ReactNode;
}) {
  const loc = useLocation();

  return (
    <div
      className={`min-h-screen flex flex-col ${
        theme === "dark"
          ? "bg-gray-900 text-gray-100"
          : "bg-gradient-to-b from-gray-50 to-white text-gray-900"
      }`}
    >
      {/* แบนเนอร์สถานะ License */}
      <LicenseBanner />

      <div className="max-w-5xl mx-auto px-4 py-10 flex-1 w-full grid gap-6">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold">AngelBot License Console</h1>

            {/* เมนูนำทาง */}
            <nav className="text-sm flex gap-3">
              <Link
                to="/"
                className={`px-2 py-1 rounded border ${
                  loc.pathname === "/"
                    ? "bg-gray-200 dark:bg-gray-800"
                    : "hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                Home
              </Link>
              <Link
                to="/admin"
                className={`px-2 py-1 rounded border ${
                  loc.pathname.startsWith("/admin")
                    ? "bg-gray-200 dark:bg-gray-800"
                    : "hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                Admin
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-sm opacity-70">
              API: <code>http://localhost:3001</code>
            </div>
            <button
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              className="border border-gray-400 rounded px-2 py-1 text-xs hover:bg-gray-200 dark:hover:bg-gray-800 transition"
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

  // เปลี่ยนคลาสบน <body> เพื่อให้โหมดสีทำงาน
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
