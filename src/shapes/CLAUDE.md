# shapes/

도형 종류별 모듈. **도형이 늘어날 때 바뀌어야 하는 유일한 폴더**다.

레이어 전체의 그림은 root의 `ARCHITECTURE.md`를 본다.

## 모듈 계약

각 도형 파일(`rect.ts`, `ellipse.ts`, `path.ts`, `line.ts`, `text.ts`)은 이 네 가지를 export한다.

```ts
export const styleFields: StyleField[]                        // 패널이 무엇을 보여줄지
export function renderPad(shape, zoom): number                // 컬링 여유
export function hitTest(shape, local, zoom): boolean          // 순수
export function draw(ctx, shape, zoom): void                  // 유일한 Canvas 의존
```

정규화가 필요한 도형은 변환 헬퍼도 함께 낸다 — `path.ts`의 `toWorldPoints`/`normalizePoints`, `line.ts`의 `endpoints`/`normalizeLine`, `text.ts`의 `layoutLines`/`alignOffset`/`fontString`. 이 헬퍼들은 `ui/`와 `dev/`도 쓴다.

**등록은 두 파일에 나눠 한다.**

| 파일 | 담는 것 | 왜 |
| --- | --- | --- |
| `registry.ts` | `HIT` · `RENDER_PAD` · `STYLE_FIELDS` · `adjustAfterResize` | 순수. 서버가 판정만 골라 쓴다 |
| `render.ts` | `DRAW` | Canvas 의존. 한 파일에 두면 서버가 Canvas를 끌어온다 |

두 매핑 타입(`HitTesters`, `Drawers`)이 `ShapeType` 전수를 요구하므로 **등록을 빠뜨리면 타입체크가 잡는다.** 유니온 값과 유니온 함수를 TypeScript가 짝지어 주지 못해 호출부에서 한 번 넓혀 쓰는 `as`가 있는데(`hitTestLocal`, `drawShapeBody`), 등록 시점에 이미 검증되므로 안전하다.

## `hitTest`는 회전을 모른다

`local`은 **회전이 이미 상쇄된 좌표**다. `core/picking.ts`의 `hitTest`가 `toLocal`을 한 번 걸어 넘긴다. 그래서 각 도형은 축 정렬 상태만 다루면 되고, 회전이 붙어도 판정 코드를 다시 짜지 않는다.

`zoom`을 쓰는 것은 얇은 도형뿐이다(`path`, `line`). 안 쓰면 `_zoom`으로 받는다 — `noUnusedParameters`가 켜져 있어 이름을 그대로 두면 빌드가 깨진다.

**여유 폭은 `HIT_PAD_PX`를 import해서 쓴다. 자체 상수를 만들지 말 것**(근거는 `ARCHITECTURE.md`의 불변식 3). 표준 형태는 이것이다.

```ts
const pad = Math.max(shape.strokeWidth / 2, HIT_PAD_PX / zoom)
```

## `draw`가 지정해야 하는 Canvas 상태

회전은 `render/renderer.ts`가 변환 행렬로 이미 걸어준 상태로 들어온다. 여기서는 축 정렬로 그린다.

그리는 순서가 고정되어 있지 않으므로(`ARCHITECTURE.md`의 불변식 7) **`fillStyle`·`strokeStyle`·`lineWidth`·`lineJoin`·`lineCap`·`font`·`textBaseline` 중 쓰는 것은 매번 지정한다.** 직전 도형이 남긴 값을 물려받으면 특정 순서에서만 재현되는 버그가 된다.

굵기의 단위가 도형마다 다르다.

| 도형 | 굵기 | 왜 |
| --- | --- | --- |
| `rect`·`ellipse` | `1.5 / zoom` | 테두리는 UI에 가깝다. 화면상 두께가 일정해야 한다 |
| `path`·`line` | `shape.strokeWidth` (월드) | 실제로 그어진 획이다. 확대하면 같이 굵어진다 |

## `renderPad` — 얼마나 삐져나오는지는 도형만 안다

뷰포트 컬링이 이 값을 쓴다. 박스만 보고 자르면 화면 가장자리에서 굵은 획과 화살촉이 잘려 보이다가 튀어 들어온다.

| 도형 | 값 | 근거 |
| --- | --- | --- |
| `rect`·`ellipse` | `0.75 / zoom` | 테두리 절반이 경계 밖 |
| `path` | `strokeWidth * 0.75` | 필압이 굵기를 1.5배까지 올린다 |
| `line` | 캡 + 화살촉 | 촉이 끝점에서 뒤로 벌어진다 |
| `text` | `fontSize * 0.3` | 글리프가 줄 높이보다 위아래로 뻗는다 |

**모자라면 도형이 사라지고, 남으면 몇 개 더 그릴 뿐이다.** 비대칭이므로 애매하면 크게 잡는다. 굵기·크기 규칙을 바꿨는데 `renderPad`를 안 고치면 `npm run bench`의 컬링 검사가 잡아낸다.

## 정규화 규약

`path`의 점과 `line`의 끝점은 바운딩 박스 기준 0~1이다.

**판정과 렌더는 반드시 월드로 펼친 뒤에 한다** (`toWorldPoints`, `endpoints`). 정규화 공간에서 거리를 재면 박스 종횡비만큼 왜곡된다.

수평선·수직선은 한 축의 폭이 0이 되므로 `normalizePoints`·`normalizeLine` 둘 다 `const dx = width || 1`로 0 나눗셈을 막는다. 새 정규화 도형을 만들면 같은 처리가 필요하다.

`normalizePoints`는 `{ ...p, x, y }`로 복사하므로 **필압 같은 부가 정보가 저절로 따라온다.** 점에 필드를 추가할 때 이 함수는 손대지 않아도 된다.

## 텍스트만 다른 것

- **크기를 스스로 정하지 못한다.** 폰트가 정하므로 브라우저 측정이 필요하다. 규칙(`layoutLines`)은 여기 순수하게 두고 `ctx.measureText`는 `render/textMetrics.ts`에서 주입한다.
- **리사이즈 뒤처리가 필요하다.** 유일하게 `adjustAfterResize`가 분기하는 도형이다. 좌우 핸들은 `wrapWidth`를, 코너·상하 핸들은 `fontSize`를 바꾼다. 그래서 `ResizeContext`가 `handle`을 함께 받는다.
- **줄바꿈 규칙에 글자 단위 끊기가 있다.** 띄어쓰기 없이 이어지는 한국어·일본어 문장이 한 줄로 삐져나가지 않게 하기 위한 것이다. 지우지 말 것.
- `draw`와 `measureTextShape`가 **같은 `fontString`을 써야** 박스와 글자가 어긋나지 않는다.

## 도형을 추가할 때

1. `core/types.ts` — `ShapeType`에 추가, `<Name>Shape` 정의, `Shape` 유니온에 추가
2. `shapes/<name>.ts` — 위 네 가지 export
3. `shapes/registry.ts` — `HIT`·`RENDER_PAD`·`STYLE_FIELDS`에 등록
4. `shapes/render.ts` — `DRAW`에 등록
5. `core/types.ts`의 `ToolId` + `ui/Toolbar.tsx` + `ui/CanvasView.tsx`의 단축키·`onPointerDown` 분기

**리사이즈·회전·핸들 코드를 건드리게 되면 멈추고 다시 본다.** 박스 모델에 맞지 않는 도형이거나 정규화를 빠뜨린 것이다. 선은 박스 모델에 가장 안 맞는 도형이었지만 정규화로 흡수됐다 — 먼저 그 길을 시도한다.

이 모델의 한계는 **핸들 구성이 도형마다 달라지는 순간**이다(예: 선의 끝점을 직접 집기). 그때는 레지스트리에 항목을 하나 더 붙일 것이 아니라 `Box` 추상을 다시 봐야 한다.

## 스타일 항목을 추가할 때

`core/types.ts`의 `StyleField`에 추가 → 지원하는 도형 모듈의 `styleFields`에 넣기 → `ui/PropertyPanel.tsx`에 컨트롤 추가.

패널은 선택된 도형들의 `styleFields` **합집합**을 그린다. 그래서 도형을 추가할 때 패널 코드는 바뀌지 않는다.

박스 크기까지 바뀌는 속성(텍스트의 `fontSize`)은 `applyStyle`에서 처리하지 않는다 — 재측정에 브라우저가 필요하고 `registry.ts`는 순수해야 한다. 호출부가 `measureTextShape`로 뒤처리한다.

## 고친 뒤 확인

`hitTest`나 `renderPad`를 바꿨으면 `npm run bench`를 돌린다. 여유 폭을 좁게 잡는 실수는 화면에 아무 표시도 내지 않는다.
