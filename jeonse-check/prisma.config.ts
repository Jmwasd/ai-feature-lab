import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7 CLI는 .env를 자동으로 읽지 않으므로 위에서 dotenv로 불러온다.
// datasource url은 prisma/config의 env()를 쓰지 않는다. env()는 값이 없으면 예외를 던져
// .env가 없는 환경(CI, 하네스)에서 generate와 build가 실패한다.
// 마이그레이션은 직접 연결(DIRECT_URL)을 쓴다. 앱 런타임은 src/server/db.ts에서 DATABASE_URL(풀러)을 쓴다(ADR-006).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DIRECT_URL,
  },
});
