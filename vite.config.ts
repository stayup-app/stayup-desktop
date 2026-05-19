import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tsconfigPaths from "vite-tsconfig-paths"

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST

export default defineConfig(async () => ({
  plugins: [react(), tsconfigPaths()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  build: {
    // Tauri 2 embeds a modern WebView — safari13 is too restrictive for plugin-store's async destructuring
    target: ["chrome105", "safari15", "firefox102"],
    minify: "esbuild",
  },
}))
