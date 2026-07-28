import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // Nenhum teste desta suíte precisa de Prisma/banco real (ver OS-017) — roda em Node puro.
    environment: "node",
  },
});
