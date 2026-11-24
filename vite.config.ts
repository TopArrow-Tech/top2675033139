import { defineConfig } from "vite";
import fs from "node:fs/promises";
import path from "node:path";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [
    react(),
    {
      name: "local-pdf-assets",
      async closeBundle() {
        for (const name of ["cmaps", "standard_fonts"])
          await fs.cp(
            path.resolve("node_modules/pdfjs-dist", name),
            path.resolve("public/pdf-assets", name),
            { recursive: true },
          );
      },
    },
  ],
  publicDir: false,
  base: "./",
  build: { outDir: "public", emptyOutDir: true },
  worker: { format: "es" },
});
