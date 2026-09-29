import "server-only";

import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

import { db } from "@/server/db";

// Auth.js v5 설정(ADR-002). Google provider는 AUTH_GOOGLE_ID·AUTH_GOOGLE_SECRET을,
// 서명 키는 AUTH_SECRET을 자동으로 읽는다. 값이 없어도 모듈 로드와 빌드는 통과하고 요청 시점에만 실패한다.
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  providers: [Google],
  // database 전략: 로그아웃하면 서버에서 세션이 바로 무효가 된다(ADR-002).
  session: { strategy: "database" },
  // Auth.js 기본 로그인 페이지 대신 랜딩으로 보낸다. 로그인 버튼은 랜딩에 둔다.
  pages: { signIn: "/" },
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
});
