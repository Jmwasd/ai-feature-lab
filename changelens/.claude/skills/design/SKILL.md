---
name: design
description: changelens 화면의 디자인 기준(색·타입·간격·컴포넌트·카피)과, 그걸 Next.js·Tailwind 코드로 옮기는 절차·위반 검사기. app/·components/의 페이지·컴포넌트·스타일·Tailwind 클래스·globals.css·폰트를 만들거나 고칠 때, UI를 리뷰할 때, "/design", "디자인 가이드대로", "UI 검사해줘" 같은 요청에 쓴다.
argument-hint: "[작업 대상 | check]"
---

# design

changelens의 디자인 기준은 이 스킬 폴더 안에 있다. `docs/UI_GUIDE.md`가 아니다.

| 파일 | 내용 |
|---|---|
| `guide.md` | 디자인 기준 원본 — §1–7 규칙(색·타입·간격·컴포넌트·카피·체크리스트), §8 화면 구성, §9 보충 |
| `check_ui.mjs` | `guide.md`를 읽어 코드의 위반을 찾는 검사기 |
| `SKILL.md` | 이 파일 — 규칙을 코드로 옮기는 절차 |

하네스는 `"ui": true`인 step의 프롬프트에 이 파일과 `guide.md`를 그대로 넣는다. 아래 경로는 모두 changelens 폴더 기준이다.

## 우선순위

1. `guide.md` §1–7 — 규칙
2. `guide.md` §8 — 화면 구성. Claude Design 프로토타입을 §1–7에 맞춰 옮긴 것이다.
3. `guide.md` §9 — 이전 가이드에서 옮겨 온 보충
4. 이 파일의 구현 방식

앞 번호가 이긴다. 프로토타입 링크(§8 맨 위)는 사람이 눈으로 보는 용도다. 값은 프로토타입이 아니라 §8을 따른다 — 프로토타입 값 일부는 §1–7과 부딪혀 바꿨고, 바꾼 자리는 §8 끝 표에 있다.

- 규칙과 값을 이 파일·step 파일·컴포넌트 주석에 옮겨 적지 마라. 값이 바뀌면 `guide.md` 한 곳만 고친다.
- `guide.md`가 정하지 않은 것(예: 커밋 카드 hover 색)이 필요하면 지어내지 마라. 대화 중이면 사용자에게 묻고, 정해지면 `guide.md`에 적는다 — 이 파일이 아니다. 하네스 step이라 물을 수 없으면 기존 토큰 안에서 가장 밋밋한 쪽(앰버·새 색 없이)을 고르고 step summary에 `가이드 미정: …`으로 남긴다.

## 절차

### 1. 읽는다

작업마다 `guide.md`를 처음부터 읽는다. 기억한 값에 기대지 마라. 화면을 만들거나 고칠 때는 §8에서 그 화면 절(랜딩 · 로그인 카드 · 차단 · `/repo` · `/repo/[sha]`)을 구조와 순서의 기준으로 삼는다. §8에 없는 화면(저장소 아님, 404 등)은 §8 「차단 · 빈 상태」 틀을 쓴다.

### 2. 기반을 확인한다 (없을 때만 만든다)

**토큰** — 값을 손으로 옮겨 적지 마라. 검사기가 `guide.md` §2 표에서 뽑아 준다.

```bash
node .claude/skills/design/check_ui.mjs --print-tokens
```

출력(`:root` 토큰 + Tailwind 연결 + `body` 기본값)을 `app/globals.css`에 넣는다. `package.json`의 Tailwind 메이저 버전을 보고 v4면 `@theme inline`, v3면 `tailwind.config.ts` 형태로 나온다.

- 클래스 이름은 토큰에서 `--`를 뗀 것이다: `bg-canvas`, `bg-surface`, `border-hairline`, `text-muted`, `bg-diff-add-bg`.
- 출력은 Tailwind 기본 팔레트를 지운다(`--color-*: initial`). `gray-500` 같은 클래스는 아예 만들어지지 않는다.
- create-next-app이 만든 `--background`·`--foreground`와 `prefers-color-scheme` 블록은 지운다.

**폰트** — `app/layout.tsx`에서 `next/font/google`로 싣는다. create-next-app 기본 `Geist`는 지운다.

```tsx
import { IBM_Plex_Mono, IBM_Plex_Sans, IBM_Plex_Sans_KR } from "next/font/google";

const plexSans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--font-plex-sans" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "600"], variable: "--font-plex-mono" });
const plexKr = IBM_Plex_Sans_KR({ weight: ["400", "600", "700"], variable: "--font-plex-kr", preload: false });

// <html lang="ko" className={`${plexSans.variable} ${plexMono.variable} ${plexKr.variable}`}>
```

- `IBM_Plex_Sans_KR`을 빼지 마라. Plex Sans·Mono에는 한글 글리프가 없어서, 빼면 한글 카피와 한글 경로(`문서/…`)가 시스템 폰트로 떨어지고 "두 서체만" 규칙이 조용히 깨진다. `--print-tokens`의 `--font-sans`·`--font-mono`가 KR을 폴백으로 잇는다.
- `next/font/google`은 빌드 때 폰트를 받아 앱과 함께 서빙한다. 실행 중에는 외부로 나가는 요청이 없다(localhost 도구에 맞다). 빌드에는 네트워크가 필요하다.

**Tailwind 대응** — `guide.md`의 px 값을 Tailwind 클래스로 쓸 때:

- 간격: 한 칸이 4px이다. `p-5` = 20px, `gap-2` = 8px. 기본 스케일에 없는 값은 쓰지 않는다.
- 모서리: 6px `rounded-md`, 12px `rounded-xl`, 9999px `rounded-full` (v3·v4 같다).
- 글자 크기: 기본 스케일과 겹치면 그대로(`text-xs` 12, `text-sm` 14, `text-base` 16, `text-lg` 18, `text-2xl` 24, `text-5xl` 48), 없으면 임의 값(`text-[13px]`)으로 쓴다. 검사기가 `guide.md` §3 크기와 대조한다.

### 3. 공용 컴포넌트를 거쳐 만든다

§8에 되풀이해 나오는 조각 — 로고, 상단 바, 버튼 3종(주·보조·작은 보조), 배지, 카드, 지표 카드, 커밋 카드, 요약 카드, 파일 목록, diff 블록, 차단 화면 틀 — 은 `components/ui/`에 한 번 만들고 화면에서는 가져다 쓴다. 화면 파일마다 같은 클래스 묶음을 다시 적지 마라 — 규칙이 코드 여러 곳으로 흩어져 한 곳을 고쳐도 나머지가 남는다. 이미 있으면 새로 만들지 말고 그걸 쓴다.

### 4. 검사한다

```bash
node .claude/skills/design/check_ui.mjs            # app/·components/ 전체
node .claude/skills/design/check_ui.mjs components  # 일부만
```

**오류 0이어야 끝이다.** 경고는 읽고 판단한다. 토큰 값 불일치, 임의 색·기본 팔레트, 그림자, 그라디언트, 블러·반투명 표면, 앰버 테두리, 초록·빨강 배경, 애니메이션·150ms 선형 밖의 전환, 모서리·간격·글자 크기·굵기 스케일 밖, 흐린 텍스트, 이모지·느낌표, diff 줄바꿈, 라이트 모드, Plex 밖의 폰트를 잡는다.

오탐이면 그 줄에 `ui-check-ignore: <이유>` 주석을 단다. 이유 없는 ignore, 진짜 위반을 가리는 ignore는 금지다.

### 5. 검사기가 못 보는 것을 직접 본다

`guide.md` §7 중 코드만으로는 판정할 수 없는 항목:

- 앰버가 **화면 단위로** 두 곳 이하인가 (컴포넌트를 조합해야 보인다)
- 숫자·sha·경로·날짜·diff가 전부 `font-mono`인가
- 초록·빨강이 증감·diff 말고 다른 뜻으로 쓰이지 않았나
- 좁은 폭(375px)에서 지표가 2×2로 접히고 diff가 가로 스크롤되나

브라우저를 띄울 수 있으면 `npm run dev` 뒤 1080px과 375px 폭에서 본다. 못 띄웠으면 못 봤다고 적는다.

### 6. 보고한다

- 검사기 마지막 줄 (`오류 N · 경고 M`) 그대로
- 5단계 항목 중 직접 확인한 것과 못 한 것
- 가이드가 정하지 않아 고른 것 (`가이드 미정: …`)

하네스 step이면 AC에 `node .claude/skills/design/check_ui.mjs`를 넣고, 위 내용을 summary에 한 줄로 줄여 남긴다.
