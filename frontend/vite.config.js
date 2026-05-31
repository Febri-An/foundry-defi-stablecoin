import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/foundry-defi-stablecoin/" : "/",
  build: {
    outDir: "../docs",
    emptyOutDir: true,
  },
}));
