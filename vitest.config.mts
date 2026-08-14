import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    // Unit tests only for now. These cover pure logic — role/permission
    // resolution, the agent tool registry, and session token signing — none of
    // which need a DOM or a live database.
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // src/lib/server/* import "server-only", which throws outside a React
      // Server Component. The package ships an empty build for exactly this —
      // it is what Next resolves under the react-server condition.
      "server-only": fileURLToPath(
        new URL("./node_modules/server-only/empty.js", import.meta.url),
      ),
    },
  },
});
