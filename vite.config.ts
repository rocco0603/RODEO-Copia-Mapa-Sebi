import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import copernicus from "./vite-plugin-copernicus";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [
      react(),
      copernicus({
        clientId: env.COPERNICUS_CLIENT_ID,
        clientSecret: env.COPERNICUS_CLIENT_SECRET,
      }),
    ],
    server: {
      proxy: {
        "/api/auth": "http://localhost:3001",
        "/api/establecimiento": "http://localhost:3001",
        "/api/lotes": "http://localhost:3001",
        "/api/health": "http://localhost:3001",
      },
    },
  };
});
