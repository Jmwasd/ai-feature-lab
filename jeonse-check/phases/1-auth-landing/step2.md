# Step 2: landing-hero

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md` ("안전" 단정 금지, 면책 문구 CRITICAL)
- `/docs/ARCHITECTURE.md` (routes 레이어, `_components/`, Server/Client 경계)
- `/docs/UI_GUIDE.md` (전체. 특히 §4 랜딩 시안 패턴, §5 모션, §6 금지 표현과 히어로 카드 예외, §8 랜딩 구성)
- `/.claude/skills/jeonse-design/SKILL.md`
- `/src/components/*` , `/src/utils/format.ts` (step 1)
- `/src/app/layout.tsx`, `/public/images/landing-hero.webp` (step 0)
- `/src/features/judgment/copy.ts` (면책 문구 원본)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

랜딩 페이지의 뼈대와 히어로, 마지막 CTA, 푸터를 만든다. 가운데 섹션(계산해 보기, 사례, 이용 방법, 데이터 출처)은 step 3·4에서 채운다.

### 1. 페이지 뼈대 (`src/app/page.tsx`)

- UI_GUIDE §8의 섹션 8개를 순서대로 배치한다. `#try`, `#cases`, `#flow`, `#sources` 섹션은 `id`와 섹션 제목만 둔 자리 컴포넌트로 둔다.
- `page.tsx`는 Server Component로 두고 조합만 한다. 섹션은 `src/app/_components/`에 파일 하나씩 둔다(랜딩 전용이므로 routes 레이어).
- TopNav 링크: 계산해 보기(`#try`) · 사례(`#cases`) · 이용 방법(`#flow`) · 데이터 출처(`#sources`). 오른쪽 CTA "지금 확인하기"(secondary)는 `/check`로 연결한다. `/check` 페이지는 step 6에서 생긴다.

### 2. 등장 모션 훅 (`src/hooks/use-reveal.ts`)

```ts
export function useReveal<T extends Element>(options?: { delayMs?: number }): { ref: RefObject<T | null>; visible: boolean };
```

- `IntersectionObserver`로 뷰포트 15% 진입 시 한 번만 `visible: true`.
- `prefers-reduced-motion: reduce`이면 처음부터 `visible: true`이고 관찰하지 않는다.
- `IntersectionObserver`가 없는 환경에서도 `visible: true`로 둔다. 이유: 관찰이 실패해 내용이 숨겨지면 안 된다.
- 테스트(`use-reveal.test.tsx`): reduced-motion, 관찰자 없음, 진입 시 전환.

### 3. 히어로 (`src/app/_components/Hero.tsx` 등)

- 배경 `/images/landing-hero.webp`는 `next/image`(`fill`, `priority`)로 둔다. 최소 높이는 UI_GUIDE §8 값.
- 순서: 상태 알약 → 롤링 헤드라인(h1, 3초마다 교체, `aria-live="polite"`, 숨은 줄 `aria-hidden`) → 리드 → CTA 두 개(primary "지금 확인하기" → `/check`, 외곽선 "이용 방법 보기" → `#flow`) → 오른쪽 떠 있는 신호 카드.
- 롤링 헤드라인 문장 3개와 리드는 이 step에서 작성한다. 해요체, UI_GUIDE §6 금지 표현 금지.
- 떠 있는 신호 카드는 UI_GUIDE §4 사양 그대로 두고 `aria-hidden`을 붙인다(예시 일러스트다).
- 레드 CTA는 뷰포트당 1~2개(UI_GUIDE §1). TopNav CTA는 secondary이므로 히어로 primary 하나만 레드다.

### 4. 마지막 CTA와 푸터

- 마지막 CTA 섹션: "계약 전에 확인하세요" + primary 버튼(`/check`) + 면책 문구. 면책 문구는 `src/features/judgment/copy.ts`에서 가져온다. 등장 모션을 주지 않는다(UI_GUIDE §5).
- FooterLight: 고객지원 / 서비스 / jeonse-check 열, 법률 밴드 "© 2026 jeonse-check".

### 5. 테스트 (`src/app/_components/*.test.tsx`)

- 랜딩 페이지 전체를 렌더링했을 때 UI_GUIDE §6 **금지 표현**이 텍스트에 없다. 단, `aria-hidden` 처리한 히어로 신호 카드는 검사에서 제외한다(§6 예외). 금지 표현 목록은 이미 `src/features/judgment/risk-report.test.ts`에 테스트 상수로 있으니 같은 출처 주석을 달아 공용 테스트 헬퍼(`src/test/forbidden-phrases.ts`)로 옮기고 두 테스트가 함께 쓰게 한다.
- 면책 문구가 렌더링된다.
- `/check`로 가는 링크가 있다.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
grep -rnE '\b(text|bg|border|shadow|rounded|p[xytrbl]?|m[xytrbl]?|gap)-\[' src/app/_components src/hooks || true   # §2 예외 치수만 남아야 한다
```

## 금지사항

- 면책 문구를 새로 쓰지 마라. `copy.ts`의 것을 쓴다. 이유: 문구 원본이 한 곳이어야 한다(UI_GUIDE §6).
- 히어로 신호 카드의 라벨·게이지·아이콘 조합을 컴포넌트로 일반화해 `src/components/`에 두지 마라. 이유: 랜딩 예시 전용이고 결과 화면에 쓰면 안 된다(UI_GUIDE §4, §6).
- 가운데 네 섹션의 내용을 만들지 마라. 이유: step 3·4 범위다.
- 애니메이션 라이브러리(framer-motion 등)를 설치하지 마라. 이유: CSS transition과 `useReveal`로 충분하고, 번들이 커진다.
- 그라디언트, 두 번째 그림자, 어두운 섹션을 만들지 마라. 이유: UI_GUIDE §7. 히어로 글자 가독성이 부족하면 이미지 위에 흰 판(`bg-canvas`)을 두는 식으로 해결한다.
- 기존 테스트를 깨뜨리지 마라.
