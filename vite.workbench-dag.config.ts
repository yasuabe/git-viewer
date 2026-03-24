import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: "workbench/dag",
  plugins: [react()],
  server: {
    fs: {
      allow: [projectRoot],
    },
  },
});
