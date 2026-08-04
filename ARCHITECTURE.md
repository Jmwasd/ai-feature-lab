# 아키텍처

Canvas 2D 화이트보드 에디터. 이 문서는 **폴더가 어떻게 나뉘어 있고 서로 어떻게 맞물리는지**만 다룬다 — 폴더별 책임과 경계, 의존 방향, 폴더 사이를 오가는 데이터, 그리고 여러 폴더가 함께 지켜야 하는 불변식이다.

한 폴더 안에서 닫히는 규약과 그 폴더의 어느 파일을 열지는 그 폴더의 `CLAUDE.md`에 있고, 해당 폴더의 파일을 열 때 자동으로 딸려 온다. 각 결정의 배경 산문은 [README.md](./README.md), 진행 상황·측정 결과·앞으로의 제약은 [ROADMAP.md](./ROADMAP.md)에 있다.

## 레이어와 의존 방향

```
        ui/            React 셸 · 포인터/키보드 입력 · textarea 오버레이
         │
         ├──────────────┐
         ▼              ▼
      store/  ◀──────  render/      브라우저(Canvas·DOM) 의존 허용 구역
         │              │
         ▼              ▼
              shapes/              draw만 브라우저 의존, 나머지는 순수
                 │
                 ▼
               core/               순수 TypeScript. window·document·Canvas 없음
```

`render/` → `store/`는 **타입만** 가져가는 간선이다(`EditorState`). `renderScene`·`drawStaticLayer`·`drawActiveLayer`가 상태를 인자로 받고 스토어를 직접 읽지 않는 덕에 벤치마크와 정합성 검사가 가짜 씬을 그려볼 수 있다.

화살표를 거스르는 import는 없다. `core/picking.ts` → `shapes/registry.ts`가 유일하게 위로 향하는 간선인데, `registry.ts`는 순수한 쪽이라 경계를 넘지 않는다.

## 폴더별 책임

**"하지 않는 것" 쪽이 경계다.** 어겨도 빌드는 통과하므로 사람이 지킨다.

| 폴더 | 맡는 것 | 하지 않는 것 |
| --- | --- | --- |
| `core/` | 좌표·기하·변환·판정·히스토리·공간 인덱스 | 브라우저를 만지지 않는다 (`window`·`document`·Canvas 없음) |
| `shapes/` | 도형별 판정·그리기·정규화·스타일 항목 | 도형끼리 서로를 모르고, 회전도 모른다 (이미 상쇄되어 들어온다) |
| `render/` | 순회·카메라 변환·컬링·선택 UI·레이어 캐시 | 도형 종류를 모르고, 스토어를 직접 읽지 않는다 |
| `store/` | 상태 보관·구독·히스토리 연결 | 씬을 계산하지 않는다. 계산은 `core/`가 하고 결과만 받는다 |
| `ui/` | 포인터·키보드 입력, React 셸, textarea 오버레이 | 캔버스 픽셀을 직접 그리지 않는다 |
| `dev/` | 벤치마크 씬·측정·정합성 검사 | 프로덕션 번들에 실리지 않는다 (정적 import 금지) |

**`core/`의 브라우저 무의존은 편의가 아니라 제약이다.** M5(협업)에서 서버가 같은 히트 테스트·좌표 계산·줄바꿈을 재사용해야 한다. 클라이언트와 서버가 다른 로직을 쓰면 편집 검증과 스냅샷 결과가 갈린다.

순수한 쪽에서 브라우저가 필요해지면 **주입한다.**

| 필요한 것 | 순수한 쪽 | 주입하는 쪽 |
| --- | --- | --- |
| 글자 폭 측정 | `shapes/text.ts`의 `layoutLines(text, wrapWidth, measure)` | `render/textMetrics.ts`의 `measurerFor` |
| 텍스트 박스 재측정 | `shapes/registry.ts`의 `adjustAfterResize(next, original, ctx)` | `ctx.measureTextShape` (호출부가 넘긴다) |

## 데이터 흐름

```
PointerEvent ──▶ CanvasView.onPointerMove
                      │
                      ├─ screenToWorld(camera)          스크린 → 월드
                      ├─ core/*  (resize·rotate·pick)   순수 계산
                      ▼
                 actions.setScene / setCamera / setDraft
                      │
                      ▼
              editorStore  ──▶ listeners
                                  │
                    ┌─────────────┴─────────────┐
                    ▼                           ▼
          subscribeRaw → dirty = true     useSyncExternalStore
          (rAF 루프가 다음 프레임에         (툴바·속성 패널만 리렌더)
           layers.render 호출)
```

### 상태가 사는 곳

| 상태 | 위치 | 수명 |
| --- | --- | --- |
| 씬·카메라·선택·도구·스타일 | `editorStore` (모듈 싱글턴) | 세션 |
| 생성 중인 도형 | `editorStore.draft` | 드래그 한 번 |
| 조작 중인 도형 id (활성 레이어의 대상) | `editorStore.active` | 드래그 한 번 |
| 진행 중인 조작 | `CanvasView`의 `useRef<Interaction>` | 드래그 한 번 |
| undo/redo 스택 | `core/history.ts`의 모듈 싱글턴 | 세션 |
| 공간 인덱스 | `core/spatial/sceneIndex.ts`의 캐시 한 벌 | 씬이 바뀔 때까지 |
| 정적 레이어 픽셀 | `render/layers.ts`의 캔버스 한 장 | `staticEpoch`·카메라·`active`가 바뀔 때까지 |

## 폴더를 가로지르는 불변식

깨지면 조용히 틀리는 것들이고, **한 폴더만 보고 있으면 어기기 쉬운 것들**이다.

### 1. 렌더링은 React 밖에서 돈다

`CanvasView`가 rAF 루프를 한 번 열고, 스토어 변경에는 dirty 플래그만 세운다. 도형을 드래그하는 동안 React 리렌더는 한 번도 일어나지 않는다.

씬·카메라·선택을 React state나 context로 옮기면 도형 수에 비례해 리렌더 비용이 붙어 이 구조가 무의미해진다. React가 맡는 것은 툴바·속성 패널·텍스트 편집기 셸뿐이다.

→ 구독 방법과 selector 규칙은 `src/store/CLAUDE.md`, 리렌더 0을 지키는 방법은 `src/ui/CLAUDE.md`

### 2. 조작 대상 상자는 `core/selection.ts`에서만 나온다

리사이즈의 대상은 도형이 아니라 **상자**(`Box` = 사각형 + 회전각)다. 하나만 골랐으면 도형 자신이 상자이고(회전까지 물려받는다), 여럿이면 회전 없는 공통 바운딩 박스다.

**`render/renderer.ts`와 `ui/CanvasView.tsx`가 반드시 같은 `getSelectionFrame`을 거친다.** 어느 한쪽에 `selection.length === 1` 같은 자체 판단을 넣으면 보이는 핸들과 집히는 핸들이 조용히 벌어진다 — 실제로 두 곳에 흩어져 있다가 합쳐진 내력이 있다. `frame.rotatable`도 마찬가지다. 그리지 않은 핸들이 집히면 안 된다.

### 3. 화면 기준 값은 `/ zoom`으로 월드에 환산한다

핸들 크기, 얇은 도형의 판정 여유, 선 굵기, 새 도형의 기본 굵기·글자 크기가 전부 화면 기준 px이다. 월드로 고정하면 축소했을 때 집을 수 없거나 보이지 않는다. 그래서 `hitTest` 체인 전체가 `zoom`을 받는다.

**`HIT_PAD_PX`는 `core/types.ts`에만 정의한다.** `shapes/`의 판정, `core/picking.ts`의 질의 범위, `core/spatial/sceneIndex.ts`의 인덱스 여유가 **셋이 함께** 이 값을 감당한다. 한 곳만 넓히거나 도형 모듈 안으로 숨기면 판정에는 걸리는데 후보에는 없는 도형이 생긴다.

### 4. 공간 인덱스는 후보만 좁히고, 판정은 그대로 둔다

quadtree는 "이 근처에 뭐가 있나"까지고 최종 판정은 `hitTest`가 한다. 그래서 인덱스가 든 사각형은 **실제 판정 영역보다 넉넉하기만 하면 된다** — 모자라면 놓치고, 남으면 후보가 몇 개 늘 뿐이다. 이 비대칭이 여유 폭을 대충 크게 잡아도 되는 근거다.

같은 비대칭이 컬링에도 적용된다(`shapes/`의 `renderPad`). **둘 다 실패 방식이 "느려짐"이 아니라 "조용히 틀림"이라, `npm run bench`가 숫자를 잴 때마다 정합성을 함께 검사한다.**

→ 캐시 전략은 `src/core/CLAUDE.md`, 검증 방법은 `src/dev/CLAUDE.md`

### 5. 히스토리는 조작이 끝날 때 한 번만 쌓인다

| 함수 | 씬 | 히스토리 | 쓰는 곳 |
| --- | --- | --- | --- |
| `actions.execute(cmd)` | 갱신 | 기록 | 도형 추가·삭제 |
| `actions.setScene(scene)` | 갱신 | — | 드래그·리사이즈·회전 중 매 프레임 |
| `actions.record(cmd)` | — | 기록 | 포인터를 뗄 때 한 번 |

매 프레임 커맨드를 쌓으면 되돌리기 한 번이 1px씩 움직인다. `ui/CanvasView.tsx`의 드래그와 `ui/PropertyPanel.tsx`의 색상 피커가 같은 규칙을 쓴다.

`Command`는 스냅샷이 아니라 `apply`/`invert` 짝이다. M5에서 그대로 네트워크로 보낼 "편집 의도" 단위가 된다.

### 6. 모든 도형이 같은 바운딩 박스 모델을 공유한다

`x/y/width/height/rotation`이 실체이고, 펜의 점과 선의 끝점은 박스 기준 0~1로 정규화되어 있다. 덕분에 `core/transform.ts`의 리사이즈·회전이 도형 종류를 모른다.

회전은 행렬이 아니라 각도 하나다. `core/geometry.ts`의 `toLocal`로 역회전한 좌표가 `shapes/`에 들어가므로 도형 모듈은 회전을 전혀 신경 쓰지 않는다.

→ 정규화 규약과 한계는 `src/shapes/CLAUDE.md`, 좌표계 왕복은 `src/core/CLAUDE.md`

### 7. 그리는 순서가 바뀔 수 있다

컬링(`render/`)이 도형을 건너뛰고 레이어 분리가 조작 중인 도형을 따로 빼내므로, 어떤 도형 뒤에 어떤 도형이 그려질지 고정되어 있지 않다. **Canvas 상태는 전역이라 각 `draw`는 자기가 쓰는 상태를 전부 지정해야 한다.** `rect.draw`가 `lineJoin`을 빠뜨려 펜 뒤에 그려질 때만 모서리가 둥글어진 버그가 실제로 있었다.

→ 지정해야 하는 상태 목록은 `src/shapes/CLAUDE.md`

### 8. 텍스트 편집 확정은 스토어에 있다

캔버스가 `mousedown` 기본 동작을 막아 textarea에서 blur가 발생하지 않는다. 그래서 편집을 끝내는 경로가 둘로 갈리고(`TextEditor`의 `Escape`/blur, `CanvasView.onPointerDown` 첫머리), 둘이 같은 처리를 공유해야 해서 `actions.commitTextEditing`이 스토어에 있다.

→ 확정의 네 갈래는 `src/store/CLAUDE.md`, IME와 포커스 처리는 `src/ui/CLAUDE.md`

### 9. 활성 집합이 선언된 동안 바뀌는 도형은 그 집합뿐이다

캔버스는 두 장이다. 아래(정적 레이어)에는 움직이지 않는 도형이, 위(활성 레이어)에는 조작 중인 도형·`draft`·선택 UI가 그려진다. **정적 레이어는 캐시라, 언제 낡는지를 정확히 알아야 한다.**

씬 참조로는 알 수 없다. 드래그 중에는 매 프레임 새 씬이 만들어지지만 실제로 바뀐 것은 잡고 있는 도형뿐이고, **그 구분을 아는 것은 스토어뿐이다.** 그래서 불변식 5의 3분기가 그대로 이어진다 — `execute`/`undo`/`redo`는 `staticEpoch`를 올리고, `setScene`은 `active`가 비어 있을 때만 올린다.

세 곳이 함께 이 계약을 지탱한다.

| 자리 | 역할 |
| --- | --- |
| `ui/CanvasView.tsx` | 조작을 시작할 때 `setActive(ids)`, 끝낼 때 `setActive([])` |
| `store/editorStore.ts` | `invalidateStatic()`을 거치는 경로를 하나로 유지 |
| `render/layers.ts` | `StaticKey`로 판단하고, 개발 빌드에서 계약 위반을 잡는다 |

**실패 방식이 불변식 4와 같다 — 느려지는 것이 아니라 조용히 틀린다.** 화면에 옛 픽셀이 남을 뿐 아무 오류도 나지 않으므로, `npm run bench`가 정적 레이어를 통짜 렌더와 픽셀 단위로 대조한다.

대가는 **조작 중인 도형이 z-order를 무시하고 맨 앞에 뜬다**는 것이다. 정확히 하려면 매 프레임 전체 순서를 다시 세워야 해서 분리한 이유가 사라지고, 어긋남은 포인터를 떼는 순간 사라진다.

→ 무효화 규칙은 `src/render/CLAUDE.md`, 스토어 쪽 조립은 `src/store/CLAUDE.md`

## 이 구조가 다음에 흔들리는 곳

`shapes/`는 도형이 늘어날 때 바뀌는 유일한 폴더이고, 나머지 다섯은 도형 수·종류와 무관하게 고정되어 있다. 이 성질이 깨지는 자리는 두 곳으로 좁혀져 있다.

- **`Box` 추상** — 핸들 구성이 도형마다 달라지면(선의 끝점을 직접 집기, M6의 그룹화) 레지스트리에 항목을 붙이는 것으로 끝나지 않고 `core/`의 상자 모델을 다시 봐야 한다.
- **`Scene`을 직접 다루는 코드** — M5에서 Yjs가 들어오면 `store/`를 중심으로 전부 영향을 받는다. `server/`·`shared/`가 생기며 최상위 구조도 바뀐다.

시점과 근거는 `ROADMAP.md`에 있다.
