import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Le client est testé sans serveur ni base : jsdom pour le DOM, `fetch`
// remplacé par un espion dans chaque test.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/setupTests.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    restoreMocks: true,
  },
});
