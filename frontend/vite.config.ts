import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: { host: true, port: 5173 },
  // Self-hosted instances answer to whatever domain their owner puts in front,
  // and that name cannot be known when the image is published.
  preview: { allowedHosts: true },
});
