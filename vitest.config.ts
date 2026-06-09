import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    environmentMatchGlobs: [["tests/client-*.test.tsx", "jsdom"]],
    globals: true,
    setupFiles: ["./tests/setup.ts"],
  },
})
