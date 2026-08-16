import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("react-aria") || id.includes("react-stately") || id.includes("@internationalized")) return "accessible-ui";
        },
      },
    },
  },
});
