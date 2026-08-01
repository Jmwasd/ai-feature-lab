# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 아키텍처

레이어 경계, 불변식, 확장 지점은 아래 파일에 있다. 이 참조는 매 세션 자동으로 함께 로드된다.

@ARCHITECTURE.md

### 폴더별 문서 (필요할 때 읽는다)

항상 싣지 않는다. 해당 폴더의 파일을 열 때 자동으로 딸려 오고, 그 전에 미리 보고 싶으면 직접 읽는다.

| 폴더 | 언제 읽나 |
| --- | --- |
| `src/core/CLAUDE.md` | 좌표·기하·리사이즈·판정·히스토리·공간 인덱스. 로컬 좌표계 왕복, 퇴화 케이스, 순수성 규약, 상수가 사는 곳 |
| `src/shapes/CLAUDE.md` | 도형을 추가하거나 판정·그리기를 고칠 때. 모듈 계약, 두 레지스트리, 정규화 규약, `renderPad` 근거 |
| `src/render/CLAUDE.md` | 그리는 순서·컬링·선택 오버레이. 한 프레임의 순서, 매 프레임 도는 코드의 비용 감각 |
| `src/store/CLAUDE.md` | 상태·히스토리 연결. selector 참조 안정성, 씬 갱신 3분기, 텍스트 편집 상태, 상태 추가 기준 |
| `src/ui/CLAUDE.md` | 포인터·키보드 조작, 패널, 텍스트 편집기. 포인터 처리 순서, 브라우저를 상대로 싸우는 자리 넷 |
| `src/dev/CLAUDE.md` | 벤치마크 씬·측정·정합성 검사. 재현성 근거, 타이머 해상도, 검증에 박힌 함정 |

## 명령어

```bash
npm run dev      # Vite 개발 서버 (http://localhost:5173)
npm run build    # tsc -b 타입체크 + 프로덕션 빌드
npm run lint     # oxlint
npm run bench    # 벤치마크 (dev 서버를 직접 띄우고 Playwright로 잰다)
```

벤치마크 플래그:

```bash
npm run bench -- --count 40000   # 도형 수
npm run bench -- --area 12000    # 흩뿌릴 월드 크기 (밀도가 바뀐다)
npm run bench -- --seed 2        # 시드 (기본 1, 실행마다 같은 씬)
npm run bench -- --json          # 기계가 읽을 형태
npm run bench -- --save base     # .bench/base.json에 저장
npm run bench -- --diff base     # 저장해둔 결과와 비교
```

## 검증

**테스트 프레임워크가 없다.** 수단은 두 가지다.

- `npm run build` — 타입체크. `strict`는 꺼져 있지만 `noUnusedLocals`/`noUnusedParameters`가 켜져 있어 안 쓰는 import·인자는 빌드를 깨뜨린다(인자는 `_` 접두사로 회피 — `_shape`, `_zoom`).
- `npm run bench` — 속도와 함께 **정합성**을 검사하고, 어긋나면 exit code 1을 낸다. 공간 인덱스 결과를 전체 훑기와 대조하고(1,400회), 컬링이 버린 도형을 더 넓은 화면에 다시 그려 아무것도 칠해지지 않는지 본다. 픽·컬링·인덱스·도형 판정을 건드렸다면 이걸 돌려야 한다.

개발 빌드 콘솔에는 `window.__editor`(상태 조회)와 `window.__bench`(벤치 실행·씬 로드)가 열려 있다.

## 버전 관리

git 저장소이고 기본 브랜치는 `main`이다. 원격은 없다 — 로컬 이력이 전부다.

- 파일을 지우거나 통째로 덮어쓰기 전에 `git status`로 **커밋 안 된 변경이 없는지** 본다. 커밋된 것은 되돌릴 수 있지만 워킹 트리의 변경은 되돌릴 수단이 없다.
- 커밋은 요청받았을 때 한다. 마일스톤 단위(M3, M4…)로 묶고, 메시지에는 **무엇을 바꿨는지가 아니라 왜 바꿨는지**를 적는다 — 진행 상황 서술은 `ROADMAP.md`가 맡는다.
- `.bench/`(측정 결과)와 `node_modules`·`dist`는 추적하지 않는다. 벤치 결과를 남겨야 하면 숫자를 `ROADMAP.md`의 표에 옮긴다.

## 코드 작성 관례

- 주석과 문서는 **한국어**로, **무엇을 하는지가 아니라 왜 그렇게 했는지**를 적는다. 기존 파일의 밀도와 어조를 따른다.
- **`dev/`를 정적으로 import하지 않는다.** `main.tsx`가 `import.meta.env.DEV` 안에서 동적 import하는 덕에 벤치마크 코드가 프로덕션 번들에서 통째로 빠진다. 정적 import 한 줄이면 전부 딸려 들어간다.
- 성능 관련 변경은 **재고 나서** 한다. 추측으로 고치면 무엇이 효과가 있었는지 알 수 없고, 실제로 M3에서 전제가 틀렸던 적이 있다 — "픽이 O(n)이라 프레임이 무너진다"고 적혀 있었지만 재보니 픽은 예산의 3%였고 무너지는 것은 렌더(334%)였다.

## 문서 역할 분담

새로 알게 된 것을 적을 때 어디에 넣을지:

| 파일 | 담는 것 |
| --- | --- |
| `CLAUDE.md` | 명령어, 검증 방법, 작업 관례 — **에이전트가 어떻게 일할지** |
| `ARCHITECTURE.md` | 레이어 경계, 불변식, 확장 지점 — **코드가 어떻게 짜여 있는지** |
| `<폴더>/CLAUDE.md` | 그 폴더 안에서만 통하는 규약·함정 — 다른 폴더를 고칠 때는 몰라도 되는 것 |
| `README.md` | 조작법 전체와 설계 노트 — **각 결정의 배경과 대가** |
| `ROADMAP.md` | 마일스톤 진행, M3 성능 측정 표, 다음에 할 일 |

구조를 바꾸는 변경(레이어 경계 이동, 불변식 추가·폐기, 새 확장 지점)은 `ARCHITECTURE.md`도 함께 고친다.
