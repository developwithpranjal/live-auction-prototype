import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  optimizeDeps: {
    force: true,
  },

  server: {
    host: "localhost",
    port: 5173,
  },
});