import { execFileSync } from "node:child_process";

import { requireLocalTestDatabaseUrl } from "./test-database-url";

// npm run test:db 전역 setup. 대상 DB를 검사한 뒤 마이그레이션을 적용한다.
// prisma.config.ts는 DIRECT_URL로 마이그레이션하므로 그 값만 TEST_DATABASE_URL로 바꿔 넘긴다.
// dotenv는 이미 있는 환경변수를 덮어쓰지 않아 .env의 DIRECT_URL이 쓰이지 않는다.
export default function setup(): void {
  const url = requireLocalTestDatabaseUrl(process.env.TEST_DATABASE_URL);
  execFileSync("prisma", ["migrate", "deploy"], {
    env: { ...process.env, DIRECT_URL: url, DATABASE_URL: url },
    stdio: "inherit",
  });
}
