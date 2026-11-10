import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  publicDir: false,
  base: "./",
  build: { outDir: "public", emptyOutDir: true },
  worker: { format: "es" },
});
