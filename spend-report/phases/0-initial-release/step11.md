# Step 11: print-export

## 읽어야 할 파일

- `/docs/UI_GUIDE.md` — **레이아웃 > 인쇄 절 필독**
- `/docs/DESIGN.md` — 4.12
- `/docs/ADR.md` — ADR-008
- `src/app/page.tsx`, `src/components/`, `src/app/globals.css`

## 작업

리포트를 브라우저 인쇄로 PDF에 담을 수 있게 만든다. **서버 렌더링 PDF를 만들지 마라** (ADR-008).

1. `globals.css`에 `@media print` 규칙:
   - `section { break-inside: avoid; }` — 섹션이 페이지 중간에서 잘리지 않게
   - `.no-print { display: none; }`
   - 배경색 강제 인쇄(`print-color-adjust: exact`)를 켜지 마라. 잉크만 먹고 가독성은 그대로다

2. `no-print` 클래스를 붙일 대상:
   - `UploadPanel` 전체
   - `OverrideControl`의 입력 UI — 다만 **사용자가 지정한 값은 인쇄돼야 한다.** 선택된 결과는 텍스트로 남기고 셀렉트 박스만 숨긴다
   - 인쇄 버튼 자체

3. 인쇄 버튼 — `window.print()` 호출. `no-print`를 단다

4. 인쇄용 헤더 — 화면에는 안 보이고 인쇄 시에만 나오는 한 줄: 리포트 기간과 생성 시각. 파일로 남았을 때 무엇인지 알 수 있어야 한다

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

수동 확인:
```bash
npm run dev
# 업로드 → 리포트 → 인쇄 미리보기(Cmd+P)
# 확인: 업로드 영역/셀렉트 박스가 안 보이는가
#       사용자가 지정한 카테고리 값은 보이는가
#       섹션이 페이지 경계에서 잘리지 않는가
#       기간·생성 시각 헤더가 있는가
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - Puppeteer·Playwright·PDF 라이브러리를 설치하지 않았는가? (ADR-008)
   - 인쇄 스타일이 화면 레이아웃을 깨뜨리지 않는가?
3. `phases/0-initial-release/index.json`의 step 11을 업데이트한다.
4. **이 step이 마지막이다.** 완료 후 `/docs/DESIGN.md` 7.2의 검증 항목을 처음부터 끝까지 한 번 실행해 보고, 통과하지 못한 항목이 있으면 `summary`에 적어라.

## 금지사항

- 서버 렌더링 PDF(Puppeteer, `@react-pdf`, `jsPDF`)를 도입하지 마라. 이유: 저장 없는 정책에 헤드리스 브라우저는 과한 장치다 (ADR-008)
- 인쇄용 별도 라우트/페이지를 만들지 마라. 이유: 두 벌이 되면 한쪽이 조용히 낡는다. 같은 DOM에 `@media print`만 얹어라
- 배경색 강제 인쇄를 켜지 마라. 이유: 잉크를 먹고 가독성은 나아지지 않는다 (UI_GUIDE)
- 사용자 보정 결과를 인쇄에서 숨기지 마라. 입력 위젯만 숨긴다. 이유: 보정값이 빠지면 인쇄된 총액의 근거가 사라진다
