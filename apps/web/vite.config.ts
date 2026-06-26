/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file configures the React SPA Vite build.
*/
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    tailwindcss(),
    viteReact(),
  ],
  server: {
    // The packaged stack publishes the console on host port 3001; the dev server runs on
    // 3011 so the two never contend for the same port when both are up.
    port: 3011,
    // Editors that save atomically (e.g. VS Code safe-write) replace the file
    // inode, which native inotify watches miss; polling makes HMR fire reliably.
    watch: { usePolling: true, interval: 120 },
  },
  preview: { port: 3011 },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
