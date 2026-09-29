import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll } from "vitest";

import { requireLocalTestDatabaseUrl } from "../../test/test-database-url";
import { PrismaClient } from "../generated/prisma/client";
import { createPrismaSavedResultRepository } from "./prisma-repository";
import { describeSavedRepositoryContract, USER_A, USER_B } from "./repository.contract";

// 실제 PostgreSQL(TEST_DATABASE_URL)에 붙는 통합 테스트. npm run test:db에서만 돈다.
const client = new PrismaClient({
  adapter: new PrismaPg({ connectionString: requireLocalTestDatabaseUrl(process.env.TEST_DATABASE_URL) }),
});

// SavedResult는 User를 참조하므로 계약 테스트의 사용자를 먼저 만든다. User를 비우면 cascade로 결과도 지워진다.
async function resetTables(): Promise<void> {
  await client.$executeRawUnsafe('TRUNCATE TABLE "User" CASCADE');
  await client.user.createMany({ data: [USER_A, USER_B].map((id) => ({ id, email: `${id}@example.com` })) });
}

afterAll(async () => {
  await client.$disconnect();
});

describeSavedRepositoryContract("prisma", async (now) => {
  await resetTables();
  return createPrismaSavedResultRepository(client, now);
});
