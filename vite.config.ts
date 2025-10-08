import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@lib": fileURLToPath(new URL("./src/lib", import.meta.url)),
      "@components": fileURLToPath(new URL("./src/components", import.meta.url)),
      "@pages": fileURLToPath(new URL("./src/pages", import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 5173,
    proxy: { "/api": { target: "http://localhost:3001", changeOrigin: true } },
  },
  preview: {
    host: true,
    port: 5174,
    proxy: { "/api": { target: "http://localhost:3001", changeOrigin: true } },
  },
});
