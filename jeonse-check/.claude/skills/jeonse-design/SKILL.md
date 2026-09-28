---
name: jeonse-design
description: jeonse-check의 화면·컴포넌트·스타일을 만들거나 고칠 때 쓴다. 페이지(랜딩, 조회 폼, 권리 입력, 결과, 저장 목록) 구현, src/components 작성, globals.css 수정, "디자인 가이드대로", "UI 만들어줘", "결과 화면" 같은 요청에 쓴다. 토큰 값은 src/app/globals.css, 디자인 규칙은 docs/UI_GUIDE.md에 있고, 이 스킬은 그 둘을 적용하고 검증하는 작업 순서다.
---

# jeonse-design

UI 작업의 **순서와 확인 방법**만 담는다. 무엇이 맞는지는 아래 두 원본이 정한다. 이 파일에 규칙이나 값을 옮겨 적지 않는다.

- 토큰 값: `src/app/globals.css` (Tailwind v4 `@theme`)
- 디자인 규칙: `docs/UI_GUIDE.md`

## 1. 읽기

1. `docs/UI_GUIDE.md` 전체
2. `src/app/globals.css` — 쓸 수 있는 토큰 이름을 확인한다
3. `docs/ARCHITECTURE.md` — 파일 위치와 Server/Client 경계
4. 결과 화면을 다룬다면 `src/features/judgment/copy.ts`, `risk-report.ts` — 화면에 쓸 문구와 신호 데이터

## 2. 준비 확인

- `src/app/layout.tsx`가 `globals.css`를 import하고, PostCSS에 `@tailwindcss/postcss`가 있는지 본다.
- Pretendard가 UI_GUIDE §1대로 붙어 있는지 본다. 없으면 이번 작업에서 붙인다.

## 3. 만들기

1. UI_GUIDE §4에서 용도가 맞는 컴포넌트·패턴을 고른다. `src/components/`에 이미 있으면 재사용한다.
2. 없으면 §4 사양대로 만든다.
3. 필요한 값이 토큰에 없으면 UI_GUIDE §2의 규칙(가장 가까운 기존 토큰 사용)을 따른다. `globals.css`를 고치지 않는다.
4. §4에 없는 컴포넌트가 필요하면 기존 컴포넌트·토큰의 조합으로 만든다. 어떤 조합으로 만들었는지 작업 결과 요약에 적는다.
5. 금액 포맷(예: "2억 8,000만")은 `src/utils/`의 공용 포맷터를 쓰고, 없으면 거기에 만든다.
6. 화면 문구 중 판정·신호 문구는 `copy.ts`에서 가져온다. 컴포넌트 안에 새로 쓰지 않는다.

## 4. 검증

```bash
npm run lint && npm run build && npm run test
```

1. **규칙 대조** — 바꾼 화면을 UI_GUIDE §6(필수 요소·금지 표현)과 §7(금지 패턴)에 한 항목씩 대조한다. 결과 화면이면 §6 필수 요소 5개가 모두 보이는지 확인한다.
2. **토큰 우회 검색** — 바꾼 파일에서 임의값을 찾아 §2 예외(레이아웃 치수)가 아니면 토큰으로 바꾼다.
   ```bash
   grep -nE '\b(text|bg|border|shadow|rounded|p[xytrbl]?|m[xytrbl]?|gap)-\[' <바꾼 파일들>
   grep -nE '#[0-9a-fA-F]{3,8}\b' <바꾼 파일들>
   ```
3. **렌더링 테스트** — 결과를 표시하는 컴포넌트를 만들었다면 테스트를 추가한다. 테스트 내용: §6 금지 표현이 렌더링 결과에 없는지, 면책 문구·데이터 기준일·출처가 있는지.
4. **눈으로 확인** — `npm run dev`로 띄워 확인한다.
   - 브레이크포인트 `tablet` 미만 폭과 `desktop` 이상 폭 두 가지에서 본다. 가로 스크롤이 없는지, §1 레드 CTA 개수를 지켰는지 확인한다.
   - OS의 동작 줄이기를 켜고 한 번 더 본다. 면책 문구·기준일·출처가 처음부터 보이는지 확인한다.
