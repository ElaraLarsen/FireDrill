import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "./", // relative assets: dist/ works from Vercel, Netlify or a GitHub Pages sub-path
  plugins: [react(), tailwindcss()],
  server: { port: 5173, host: true },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
