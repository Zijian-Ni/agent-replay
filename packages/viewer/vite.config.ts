import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  base: "/agent-replay/",
  root: resolve(__dirname, "src"),
  build: {
    outDir: resolve(__dirname, "dist"),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    open: true,
  },
});
