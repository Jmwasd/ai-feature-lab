import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "./generated/prisma/client";

// Prisma 클라이언트는 이 파일 한 곳에서만 생성한다(ARCHITECTURE.md server 규칙).
// 런타임은 풀러 연결(DATABASE_URL)을 쓴다. 마이그레이션용 DIRECT_URL은 prisma.config.ts가 쓴다(ADR-006).
// 생성만 하고 연결은 첫 쿼리 때 맺으므로 빌드 시점에 DB가 없어도 된다.
function createClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

// 개발 모드 핫리로드마다 인스턴스가 늘지 않도록 globalThis에 보관한다.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db: PrismaClient = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
