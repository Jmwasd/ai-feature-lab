import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// 실제 PostgreSQL에 붙는 통합 테스트(npm run test:db). 기본 npm run test와 Stop 훅에는 넣지 않는다.
// 대상은 TEST_DATABASE_URL(로컬 Docker)뿐이다. 검사와 마이그레이션은 전역 setup이 맡는다.
const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? "";

export default defineConfig({
  resolve: {
    alias: {
      "server-only": fileURLToPath(new URL("./src/test/server-only-stub.ts", import.meta.url)),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    name: "db",
    environment: "node",
    include: ["src/**/*.db.test.ts"],
    globalSetup: ["./src/test/db-global-setup.ts"],
    // 테스트마다 같은 테이블을 비우므로 파일을 순서대로 돌린다.
    fileParallelism: false,
    // 실수로 src/server/db.ts의 기본 클라이언트를 쓰더라도 개발 DB가 아니라 테스트 DB에 닿게 한다.
    env: { DATABASE_URL: testDatabaseUrl, DIRECT_URL: testDatabaseUrl },
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
