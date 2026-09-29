import { describe, expect, it } from "vitest";

import { requireLocalTestDatabaseUrl } from "./test-database-url";

describe("requireLocalTestDatabaseUrl", () => {
  it("값이 없으면 TEST_DATABASE_URL이 필요하다고 실패한다", () => {
    expect(() => requireLocalTestDatabaseUrl(undefined)).toThrow(/TEST_DATABASE_URL이 필요하다/);
    expect(() => requireLocalTestDatabaseUrl("  ")).toThrow(/TEST_DATABASE_URL이 필요하다/);
  });

  it.each([
    "postgresql://postgres:postgres@localhost:5433/jeonse_check_test",
    "postgresql://postgres:postgres@127.0.0.1:5433/jeonse_check_test",
    "postgres://u:p@LOCALHOST/db",
  ])("로컬 주소는 그대로 돌려준다: %s", (url) => {
    expect(requireLocalTestDatabaseUrl(url)).toBe(url);
  });

  it.each([
    "postgresql://u:p@db.example.supabase.co:5432/postgres",
    "postgresql://postgres.ref:p@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres",
    "postgresql://u:p@10.0.0.5:5432/db",
    "postgresql://u:p@localhost.evil.com:5432/db",
  ])("원격 주소는 거부한다: %s", (url) => {
    expect(() => requireLocalTestDatabaseUrl(url)).toThrow(/로컬/);
  });

  it("호스트가 로컬이어도 supabase가 들어 있으면 거부한다", () => {
    expect(() => requireLocalTestDatabaseUrl("postgresql://u:p@localhost:5432/supabase_copy")).toThrow(/supabase/);
  });

  it("URL 형식이 아니면 거부한다", () => {
    expect(() => requireLocalTestDatabaseUrl("not a url")).toThrow(/TEST_DATABASE_URL/);
  });
});
