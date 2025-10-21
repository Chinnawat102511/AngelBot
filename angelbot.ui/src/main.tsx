import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// ✅ เพิ่มบรรทัดนี้ (import SoundProvider)
import { SoundProvider } from "./components/SoundPack";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {/* ✅ หุ้ม App ด้วย SoundProvider */}
    <SoundProvider>
      <App />
    </SoundProvider>
  </React.StrictMode>
);
