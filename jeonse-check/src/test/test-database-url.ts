// npm run test:db 대상 DB 주소 검사. 통합 테스트는 테이블을 비우므로 로컬 DB만 허용한다(ADR-006).
// 개발 DB(DATABASE_URL)는 쓰지 않고 TEST_DATABASE_URL만 받는다.

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

export function requireLocalTestDatabaseUrl(value: string | undefined): string {
  if (!value || value.trim() === "") {
    throw new Error(
      "TEST_DATABASE_URL이 필요하다. 로컬 Docker Postgres 주소를 지정한다(.env.example 참고).",
    );
  }

  let hostname: string;
  try {
    hostname = new URL(value).hostname.toLowerCase();
  } catch {
    throw new Error("TEST_DATABASE_URL이 올바른 URL이 아니다.");
  }

  if (!LOCAL_HOSTS.has(hostname)) {
    throw new Error(
      `TEST_DATABASE_URL 호스트(${hostname})가 로컬(localhost, 127.0.0.1)이 아니다. 테스트가 테이블을 비우므로 원격 DB는 거부한다.`,
    );
  }
  if (value.toLowerCase().includes("supabase")) {
    throw new Error("TEST_DATABASE_URL에 supabase가 들어 있다. 운영 DB에는 테스트를 돌리지 않는다(ADR-006).");
  }
  return value;
}
