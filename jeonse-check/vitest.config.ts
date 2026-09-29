import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // server-only는 react-server 조건 밖에서 import하면 예외를 던진다. 테스트에서는 빈 모듈로 바꾼다.
      "server-only": fileURLToPath(new URL("./src/test/server-only-stub.ts", import.meta.url)),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
