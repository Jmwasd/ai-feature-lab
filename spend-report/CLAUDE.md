# 프로젝트: spend-report

은행 거래내역 CSV를 업로드하면 소비 패턴 **발견형** 리포트를 한 화면으로 보여준다.
설계 근거 전문은 `docs/DESIGN.md`에 있다. 결정을 바꾸려면 그 문서를 먼저 읽어라.

## 기술 스택
- Next.js 15 (App Router)
- TypeScript strict mode
- Tailwind CSS
- Vitest (단위 테스트)
- OpenAI API (분류 보조 + 요약)

## 아키텍처 규칙

- CRITICAL: **금액 계산을 LLM에 시키지 마라.** 모든 숫자는 `src/lib/`의 순수 함수가 계산한다. LLM은 (a) 미분류 가맹점명 분류, (b) 계산된 집계치를 문장으로 옮기기 — 이 둘만 한다. 이유: 없는 합계를 지어내는 실패가 이 도메인에서 치명적이다 (DESIGN.md 4.3)
- CRITICAL: **업로드 파일을 디스크·DB·로그 어디에도 저장하지 마라.** 요청 처리 후 메모리에서 폐기한다. 이유: 개인 금융정보의 보관 책임을 지지 않기로 했다 (DESIGN.md 4.1)
- CRITICAL: **LLM에 금액·계좌번호·성명을 보내지 마라.** 분류 단계에는 미분류 적요 문자열만 보낸다 (DESIGN.md 4.4, 8.1)
- CRITICAL: **OpenAI API 키는 서버에서만 읽는다.** 클라이언트 컴포넌트나 `NEXT_PUBLIC_*`에 두지 마라
- CRITICAL: **`fixtures/`의 파일을 커밋하지 마라.** 실명·계좌번호가 든 실제 거래내역이다. 테스트에서 읽기만 한다 (DESIGN.md 7.1)
- `src/lib/`는 순수 함수만 둔다. React·Next·fs·네트워크를 import하지 마라. 서버와 클라이언트 양쪽에서 import되기 때문이다 (DESIGN.md 4.2)
- 외부 API 호출은 `src/services/`에서만 한다. 컴포넌트에서 직접 호출하지 마라
- 타입은 `src/types/`, UI는 `src/components/`에 분리한다

## 개발 프로세스

- CRITICAL: `src/lib/` 코드는 반드시 테스트를 먼저 작성하고, 통과하는 구현을 작성할 것 (TDD)
- UI 컴포넌트와 페이지에는 테스트를 요구하지 않는다 (DESIGN.md 6절 테스트 규율)
- 커밋 메시지는 conventional commits 형식을 따를 것 (feat:, fix:, docs:, refactor:)
- Harness step 실행 중이라면 `phases/<phase>/index.json`의 status를 반드시 갱신하고 끝낼 것

## 명령어
```
npm run dev      # 개발 서버
npm run build    # 프로덕션 빌드
npm run lint     # ESLint
npm run test     # Vitest
```

## Harness

```
python3 scripts/execute.py 0-initial-release          # 순차 실행
python3 scripts/execute.py 0-initial-release --push   # 실행 후 push
```

인자는 경로가 아니라 `phases/` 하위 **디렉토리 이름**이다.

주의: git 저장소 루트는 이 폴더가 아니라 모노레포 루트(`ai-feature-lab`)다. `execute.py`의 `git add -A`가 저장소 전체를 대상으로 하므로, 실행 전에 다른 프로젝트 폴더에 미커밋 변경이 없는지 확인하라.
