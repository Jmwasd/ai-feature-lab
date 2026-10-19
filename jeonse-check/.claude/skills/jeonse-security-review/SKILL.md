---
name: jeonse-security-review
description: jeonse-check의 보안을 검토한다. PR 리뷰 · 배포 전 점검 · Server Action · 로그인/callbackUrl · 결과 저장 · 환경변수 · XSS · 에러 노출 점검에 쓴다. "보안 검토", "보안 점검", "security review" 요청에 쓴다.
---

# jeonse-check 보안 검토

내장 `/security-review`(일반 검토)와 달리 이 앱의 구조 기준으로 본다. 레이어 규칙은 `docs/ARCHITECTURE.md`, 인증 결정은 `docs/ADR.md` ADR-002를 따른다.

## 원칙

1. Server Action과 Route Handler는 공개 엔드포인트다. 브라우저에서 온 값은 모두 조작될 수 있다
2. `proxy.ts`와 클라이언트 검증은 1차 차단일 뿐이다. 실제 통제는 서버의 `auth()` 재확인과 서버 재검증이다
3. 코드로 확인하지 못한 것(배포 헤더 · Supabase · OAuth 콘솔 설정)은 PASS로 적지 않고 "확인 필요"로 적는다

## 절차

1. 범위를 정한다. 브랜치 변경분(`git diff origin/main...`)인지, 전체인지
2. `src/`를 검색한다. `src/server/generated/`는 제외한다
   - 진입점: `"use server"` · `route.ts`
   - 위험 패턴: `dangerouslySetInnerHTML` · `NEXT_PUBLIC_` · `process.env` · `redirect(` · `callbackUrl` · `$queryRawUnsafe` · `error.message`
3. 아래 항목마다 PASS / WARN / FAIL / 확인 필요로 판정한다
4. 출력 형식에 맞춰 보고한다. 사용자가 요청하기 전에는 코드를 고치지 않는다

## 체크 항목

1. **인증 · 인가**
   - 모든 Server Action과 보호 페이지가 첫머리에서 `await auth()`를 부르는가
   - 사용자 데이터를 클라이언트가 보낸 id가 아니라 `session.user.id`로 거르는가(`{ id, userId }` 조회)
   - 새 보호 경로를 만들었다면 `proxy.ts`의 `matcher`와 `PROTECTED_PREFIXES`를 둘 다 고쳤는가
2. **서버 경계 · 비밀값**
   - `"use client"` 파일이 `@/server/*`를 import하지 않는가
   - `src/server/`의 새 파일 첫 줄에 `import "server-only"`가 있는가
   - `NEXT_PUBLIC_*` 변수가 새로 생기지 않았는가
   - Server Action의 반환값이나 Client Component로 넘기는 props에 키 · 원본 응답 필드가 실리지 않는가
3. **결과 저장 무결성**
   - 저장은 `verifyResultToken()`을 통과한 값만 쓰는가. 클라이언트가 보낸 결과를 그대로 저장하면 FAIL
   - 판정 입력을 서버에서 zod로 다시 검증하는가
   - 주소는 서버가 다시 조회한 값을 쓰는가(`run-check.ts`)
4. **XSS**
   - `dangerouslySetInnerHTML`에 런타임 외부 값이 들어가지 않는가
   - 지금 쓰는 곳은 `/chat-log` 하나다. 빌드 시점에 만든 HTML이고 로그인 없이 공개된다
5. **Redirect**
   - `callbackUrl`은 반드시 `safeCallbackUrl()`을 거치는가
   - 이 함수를 고쳤다면 `//evil.com`, `/\evil.com`을 막는 테스트가 있는가
6. **에러 · 로그 · 개인정보**
   - Server Action이 오류를 코드로만 돌려주는가. `error.message`를 돌려주면 FAIL(요청 URL에 키가 담길 수 있다)
   - `error.tsx`가 `message`, `stack`을 화면에 그리지 않는가
   - 새 키 파라미터 이름이 생기면 `http.ts`의 `SECRET_PARAMS`에 추가했는가
   - 주소 · 보증금 · 권리 입력을 URL · localStorage · 로그에 남기지 않는가
   - 공개 데이터 `chat-log.json`에 키 · `.env` 값 · 개인 주소가 섞이지 않았는가
7. **그 밖**
   - `$queryRawUnsafe`에 사용자 값이 들어가지 않는가
   - 상태를 바꾸는 작업을 GET으로 하지 않는가
   - 보안 헤더는 `next.config.ts`에 없다 → 확인 필요로 적는다

## 등급

- Critical: 비밀값이 번들 · 응답 · 공개 페이지에 노출됨, 세션 확인 없는 저장 · 삭제, 서명 검증 우회
- High: 남의 저장 결과에 접근(IDOR), Open Redirect, 런타임 XSS, 조작된 판정 결과가 저장됨
- Medium: 내부 정보가 담긴 에러 문구, 공개 페이지의 개인정보, 보안 헤더 없음
- Low: 불필요한 `console`, 오래된 의존성

## 출력 형식

```
## Summary
Overall Risk: <가장 높은 Finding 등급>  — 검토 범위 1~2문장

## Findings
### [HIGH] 제목
- 위치: <파일>:<줄>
- 문제 / 공격 시나리오 / 권장 수정

## 확인 필요
- (코드로 확인하지 못한 것)

## Checklist
| 항목 | 결과 | 비고 |
|---|---|---|
| 1. 인증 · 인가 | | |
| 2. 서버 경계 · 비밀값 | | |
| 3. 결과 저장 무결성 | | |
| 4. XSS | | |
| 5. Redirect | | |
| 6. 에러 · 로그 · 개인정보 | | |
| 7. 그 밖 | | |
```

Finding은 파일 · 줄 · 코드 근거가 있는 것만 등급이 높은 순으로 적는다.
