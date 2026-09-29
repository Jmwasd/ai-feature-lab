// 테스트 전용(mock 레이어). 공공데이터 응답 fixture를 읽고, 실제 네트워크 대신 쓸 가짜 fetch를 만든다.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { FetchLike } from "../http";

// 이 폴더의 fixture 파일을 문자열로 읽는다.
export function loadFixture(name: string): string {
  return readFileSync(fileURLToPath(new URL(name, import.meta.url)), "utf8");
}

// fixture 파일 이름 또는 응답 본문·상태 코드.
export type FakeRoute = string | { body: string; status?: number };

export type FakeFetch = FetchLike & { calls: URL[] };

// URL 경로(pathname)별로 응답을 돌려주는 가짜 fetch. 등록되지 않은 경로는 404다.
// 받은 요청 URL은 calls에 남아 쿼리 파라미터를 검증할 수 있다.
export function createFakeFetch(routes: Record<string, FakeRoute>): FakeFetch {
  const calls: URL[] = [];
  const fake = async (url: string): Promise<Response> => {
    const parsed = new URL(url);
    calls.push(parsed);
    const route = routes[parsed.pathname];
    if (route === undefined) {
      return new Response("not found", { status: 404 });
    }
    if (typeof route === "string") {
      return new Response(loadFixture(route), { status: 200 });
    }
    return new Response(route.body, { status: route.status ?? 200 });
  };
  return Object.assign(fake, { calls });
}
