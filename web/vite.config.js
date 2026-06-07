import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The admin SPA is served from the backend under /admin, so all
// asset URLs are prefixed with /admin/. In dev, proxy API + SSE
// calls to the Express server on :3000.
export default defineConfig({
  plugins: [react()],
  base: "/admin/",
  build: {
    outDir: path.join(__dirname, "..", "public", "admin"),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:3000", changeOrigin: true },
    },
  },
});
