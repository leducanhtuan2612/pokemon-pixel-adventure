import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/phaser")) return "phaser";
          if (id.includes("node_modules/react") || id.includes("node_modules/zustand")) return "react-vendor";
          if (id.includes("/src/game/data/generated/")) return "game-data";
        },
      },
    },
  },
});
