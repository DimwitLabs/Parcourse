import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import pkg from "./package.json";
import { THEME_KEY } from "./src/lib/theme";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "theme-key",
      transformIndexHtml: (html: string) => html.replaceAll("__THEME_KEY__", THEME_KEY),
    },
  ],
  // Baked in at build time so the running app can say which build it is,
  // without shipping the rest of package.json to the browser.
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  server: { port: 5173 },
  preview: { allowedHosts: true },
});
