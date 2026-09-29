import type { DefaultSession } from "next-auth";

// database 세션 콜백(src/server/auth.ts)이 채우는 사용자 id를 타입에 반영한다.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}
