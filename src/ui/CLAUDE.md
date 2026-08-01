# ui/

React 컴포넌트. 입력을 받고 셸을 그린다. **캔버스 픽셀은 여기서 그리지 않는다.**

레이어 전체의 그림은 root의 `ARCHITECTURE.md`를 본다.

| 파일 | 하는 일 |
| --- | --- |
| `CanvasView.tsx` | 캔버스 두 장 + rAF 렌더 루프 + 포인터·휠·키보드 조작 전부 |
| `TextEditor.tsx` | 캔버스 위에 겹친 진짜 textarea |
| `PropertyPanel.tsx` | 색·굵기·글꼴 편집 |
| `Toolbar.tsx` | 도구 선택, undo/redo, 상태 표시 |

`App.tsx`가 `Toolbar` 아래에 `.stage`를 두고 `CanvasView`·`TextEditor`·`PropertyPanel`을 절대 위치로 겹친다.

## 캔버스는 두 장이다

`CanvasView`가 `.canvas-static`과 `.canvas-active`를 같은 자리에 겹쳐 낸다. 무엇이 어느 쪽에 그려지는지는 `render/CLAUDE.md`에 있고, 여기서 지켜야 할 것은 셋이다.

1. **포인터 이벤트는 늘 위쪽(`.canvas-active`)이 받는다.** 정적 레이어는 `pointer-events: none`이다. 좌표 계산이 한 요소 기준으로 고정되어야 `getBoundingClientRect` 결과가 갈리지 않는다.
2. **`z-index`를 주지 않는다.** DOM 순서만으로 정적 < 활성 < `TextEditor` < `PropertyPanel`이 된다. 한쪽에 주는 순간 나머지도 전부 매겨야 한다.
3. **`resize`에서 `layers.invalidate()`를 부른다.** `canvas.width = ...`는 같은 값을 넣어도 내용을 지우므로, 크기가 그대로인 `ResizeObserver` 호출에서도 정적 레이어가 빈 화면으로 남는다.

## 드래그 중 React 리렌더는 0이어야 한다

`CanvasView`는 마운트 시 rAF 루프를 한 번 열고, `subscribeRaw`로 **dirty 플래그만** 세운다. 도형을 옮기는 동안 컴포넌트는 다시 그려지지 않는다.

이 성질을 깨는 방법은 셋이고, 전부 피한다.

1. **씬·카메라를 `useEditor`로 구독하지 않는다.** `CanvasView`는 스토어를 `getState()`로 읽는다. 구독하면 매 프레임 리렌더된다.
2. **진행 중인 조작은 `useRef`에 둔다.** `Interaction` 유니온(`idle`/`pan`/`draw`/`pen`/`line`/`move`/`resize`/`rotate`/`marquee`)이 ref에 있고, 필드를 직접 변형한다(`current.last = screen`). 상태 머신이지 렌더 입력이 아니다.
3. **`Toolbar`·`PropertyPanel`은 필요한 값만 구독한다.** `useEditor((s) => s.tool)`처럼 원시값 단위로 쪼갠다.

## 포인터 처리 순서 (`onPointerDown`)

순서 자체가 규칙이다.

```
1. setPointerCapture              캔버스 밖으로 나가도 이벤트를 계속 받는다
2. editingId면 commitTextEditing   ← 이 뒤에 다시 getState() (도구가 바뀔 수 있다)
3. 스페이스 / 휠 클릭 → 팬          도구와 무관하게 항상
4. 도구별 분기 (text/pen/line/rect)
5. 핸들 검사                       ← 도형 히트보다 먼저
6. 도형 히트 (Shift = 선택 토글)
7. 빈 곳 → 마퀴
```

**5가 6보다 먼저인 것이 중요하다.** 핸들은 도형 경계 밖에 걸쳐 있어서, 순서가 뒤바뀌면 코너 핸들을 집으려다 뒤에 있는 도형이 선택된다.

**2 뒤에 상태를 다시 읽는 것도 중요하다.** `commitTextEditing`이 도구를 `select`로 바꿀 수 있어서, 미리 읽어둔 `tool`을 쓰면 방금 확정한 텍스트 위에 새 텍스트가 하나 더 생긴다.

`Shift` + 클릭은 **선택만 토글하고 이동을 시작하지 않는다.** 선택을 다듬는 동작과 옮기는 동작을 섞지 않기 위해서다.

## 브라우저를 상대로 싸우는 자리 넷

여기 있는 우회들은 전부 이유가 있다. 정리하고 싶어지면 먼저 왜 있는지 확인한다.

**`onMouseDown={(e) => e.preventDefault()}`** — `mousedown`의 기본 동작은 포커스 이동이다. 그대로 두면 텍스트 도구로 클릭했을 때 방금 띄운 textarea가 포커스를 빼앗겨 편집이 즉시 취소된다("텍스트 입력이 아예 안 된다"는 증상). 대가로 blur가 발생하지 않으므로 위 순서의 2번이 필요하다.

**휠은 `addEventListener(..., { passive: false })`** — React의 `onWheel`은 passive라 `preventDefault`가 먹지 않는다. 막지 않으면 페이지가 스크롤된다. 트랙패드 핀치도 `ctrlKey`가 붙은 wheel로 들어온다.

**키보드는 `window`에서 듣는다** — 캔버스는 포커스를 받지 않기 때문이다. 대신 두 가지를 걸러낸다.

```ts
if (getState().editingId) return                                    // 편집 중
if (target.tagName === 'INPUT' || target.tagName === 'SELECT') return  // 패널 입력 칸
```

**입력 요소를 새로 추가하면 이 필터도 확인한다.** 빠뜨리면 색상 코드에 `r`을 치는 순간 도구가 바뀌고 `Backspace`가 도형을 지운다. `textarea`가 목록에 없는 것은 `TextEditor`가 `stopPropagation`으로 직접 막기 때문이다.

**`getCoalescedEvents()`** — 포인터 이벤트는 화면 갱신 주기에 맞춰 합쳐져 들어온다. 빠르게 그으면 그 사이 위치가 통째로 버려져 획이 눈에 띄게 각진다. 펜은 합쳐지기 전의 원본을 꺼내 전부 반영한다.

## 조작을 시작할 때 활성 집합을 선언한다

도형을 잡는 세 조작(`move`·`resize`·`rotate`)은 `interaction.current`를 세울 때 `actions.setActive(ids)`를 함께 부르고, `onPointerUp` 첫머리에서 `setActive([])`로 비운다. 이것이 정적 레이어에게 **"포인터를 뗄 때까지 바뀔 도형은 이것뿐"**이라고 알리는 유일한 통로다.

**새 조작을 추가할 때 씬의 도형을 고친다면 여기에도 등록해야 한다.** 빠뜨리면 그 도형이 정적 레이어에 남은 채로 활성 레이어에도 그려져 잔상이 생긴다 — 개발 빌드 콘솔에 `[layers]` 경고가 뜬다.

`pan`·`marquee`와 도형 생성(`draw`/`pen`/`line`/`text`)은 등록하지 않는다. 팬은 카메라가 바뀌어 어차피 정적 레이어가 다시 그려지고, 생성 중인 도형은 `draft`라 늘 활성 레이어에 있다.

## 드래그 한 번 = 커맨드 한 개

`onPointerMove`는 `setScene`, `onPointerUp`은 `record`다(3분기의 근거는 `ARCHITECTURE.md`의 불변식 5). 이 폴더에서 지켜야 할 두 가지는 이것이다.

**`record` 전에 실제로 값이 바뀌었는지 확인한다** — `hasGeometryChanged`. 참조 비교로는 포인터가 1px 흔들려도 기록된다.

**리사이즈·회전은 매 프레임 `Interaction`에 든 원본에서 다시 계산한다.** 직전 결과에 누적하면 부동소수 오차가 쌓이고, 드래그 도중 `Shift`를 눌렀다 떼는 조작을 되돌릴 수 없다.

## `PropertyPanel` — 미리보기와 확정을 나눈다

React의 `onChange`는 DOM의 `input`이다. 색상 피커를 끄는 내내, 숫자를 한 글자씩 고치는 내내 들어온다. 그대로 히스토리에 쌓으면 되돌리기 한 번이 색 한 단계씩 되감긴다.

`LiveInput`이 이 분리를 담당한다 — `onChange`는 `setScene`(미리보기), DOM `change`는 `record`(확정). `change`를 React가 노출하지 않아 `useEffect`로 직접 붙였다. 버튼·드롭다운은 한 번의 조작으로 끝나므로 `setFieldAndCommit`으로 바로 확정한다.

`pending` ref가 조작 시작 시점의 도형들을 들고 있다가 히스토리의 before가 된다.

**패널이 무엇을 보여줄지는 도형 모듈이 정한다**(`styleFieldsOf`의 합집합). 도형을 추가해도 이 파일은 바뀌지 않는다. 값이 갈리면 `commonValue`가 null을 돌려주고 "혼합"으로 표시한다 — 아무 값이나 보여주면 그 값으로 통일된 것처럼 보인다.

## `TextEditor` — IME가 우선이다

조합 중(`composing` ref 또는 `isComposing`)의 `Enter`·`Escape`는 IME의 것이다. 한글에서 `Enter`는 조합 확정, `Escape`는 조합 취소다. 편집 종료로 처리하면 **확정하려던 글자가 사라지거나 한 글자 지우려던 `Escape`가 편집 전체를 닫는다.**

`compositionstart`/`end`로 직접 들고 있는 이유는 조합을 끝내는 키에서 `isComposing` 값이 브라우저마다 갈리기 때문이다. `compositionend`에서 박스를 한 번 더 재는 것도 필요하다 — 브라우저에 따라 그 뒤에 `change`가 오지 않아, 없으면 마지막 글자만큼 박스가 모자란다.

내용이 바뀔 때마다 `measureTextShape`로 박스를 다시 잰다. 텍스트는 폰트가 크기를 정하는 유일한 도형이다.

고정 폭일 때 줄바꿈은 브라우저(`white-space: pre-wrap`)에 맡긴다. 캔버스 규칙과 완전히 같지 않아 경계에 걸친 단어가 다르게 접힐 수 있지만, textarea 안에서 캐럿 이동과 선택을 직접 구현하는 것보다 낫다.

## 핸들

`selectionFrame()`은 도구가 `select`일 때만 프레임을 낸다 — **이 도구 조건이 여기서 추가하는 유일한 판단이고, 그 외에는 `getSelectionFrame`이 준 것을 그대로 쓴다**(`ARCHITECTURE.md`의 불변식 2).

회전한 도형의 커서는 `cursorForHandle`이 핸들 방향에 회전각을 더해 8방위 중 가장 가까운 것을 고른다.

## 고친 뒤 확인

타입체크는 `npm run build`. 조작 변경은 **직접 만져보는 것 외에 자동 검증이 없다.** 최소한 이것들은 손으로 확인한다.

- 텍스트 만들기 → 한글 입력 → `Escape` / 바깥 클릭 / 빈 채로 종료
- 회전한 도형 리사이즈 (미끄러지지 않는지)
- 다중 선택 리사이즈 + `Shift`/`Alt`
- 되돌리기 한 번이 조작 하나를 되돌리는지 (1px씩 되감기지 않는지)
- **도형을 끌고 놓았을 때 원래 자리에 잔상이 남지 않는지** — 레이어 분리가 틀리면 여기서만 보인다
- **창 크기를 바꿨을 때 도형이 사라지지 않는지** — 정적 레이어 백버퍼가 지워지는 자리다

도형 수가 많을 때의 체감은 콘솔에서 `__bench.load({ count: 10000 })`으로 씬을 밀어 넣고 확인한다.
