# core/

프레임워크와 브라우저에 의존하지 않는 순수 로직. 좌표·기하·변환·판정·히스토리가 여기 있다.

레이어 계약(브라우저 무의존, 주입 지점)은 root의 `ARCHITECTURE.md`가 소유한다. 이 문서는 **`core/` 안에서 코드를 고칠 때 필요한 것**만 다룬다.

## 순수성은 타입체커가 막아주지 않는다

`tsconfig.app.json`의 `lib`에 `DOM`이 들어 있어 `core/`에서 `document.createElement`를 써도 빌드는 통과한다. 사람이 지켜야 하는 규율이다.

주입 말고 **제네릭으로 여는 방법**도 있다. `simplifyPath<T extends Point>`가 점을 새로 만들지 않고 원본 원소를 통과시키므로, 필압처럼 점에 실린 부가 정보가 저절로 살아남는다. 자료구조로 풀 수 있으면 주입점을 늘리지 않는다.

## 내부 의존 그래프

```
types.ts ────────────────┐  (잎. 아무것도 import하지 않는다)
   ├──▶ camera.ts        │  좌표 변환만. 다른 core 모듈과 무관
   ├──▶ commands.ts ──▶ history.ts
   └──▶ geometry.ts
          ├──▶ transform.ts     리사이즈·회전
          ├──▶ simplify.ts      RDP
          ├──▶ selection.ts     선택 → Box
          ├──▶ spatial/quadtree.ts ──▶ spatial/sceneIndex.ts
          └──▶ picking.ts ──▶ spatial/sceneIndex.ts
                    └──▶ shapes/registry.ts   ← 유일하게 폴더 밖으로 나가는 간선
```

`picking.ts` → `shapes/registry.ts`는 경계 위반이 아니다. `registry.ts`는 순수한 쪽이고, 도형별 판정을 `core/`가 알 필요는 없다는 뜻이기도 하다. **반대 방향(`shapes/`가 `picking.ts`를 부르는 것)은 순환이므로 안 된다.**

## 세 가지 사각형 타입

| 타입 | 필드 | 뜻 |
| --- | --- | --- |
| `Rect` | x, y, width, height | 축 정렬 사각형 |
| `Box` | `Rect` + rotation | 조작 대상. 핸들과 리사이즈는 도형이 아니라 이것에 대해 정의된다 |
| `Shape` | `Box` + id/fill/stroke + 종류별 필드 | 실제 도형 |

**`Shape`는 구조적으로 `Box`다.** 그래서 `getSelectionFrame`이 단일 선택에서 도형을 변환 없이 그대로 상자로 넘긴다(`{ box: shapes[0], ... }`). 새 함수를 만들 때 `Shape`를 받을 이유가 없으면 `Box`나 `Rect`로 받는다 — `getWorldBounds`, `pickHandle`, `resizeLocalBox`가 그렇게 되어 있고, 덕분에 다중 선택 공통 박스에 같은 코드가 그대로 쓰인다.

## 로컬 좌표계 왕복

회전한 상자를 다루는 코드는 전부 같은 3단계를 탄다. 월드 좌표에서 바로 계산하면 회전각이 붙는 순간 어긋난다.

```
1. toLocal(point, box)          회전을 상쇄한 계로 옮긴다 (중심 기준 -rotation)
2. 축 정렬 상태로 계산            여기서는 회전을 잊어도 된다
3. rotatePoint(result, center, box.rotation)   다시 월드로
```

**3단계를 빠뜨리면 회전된 도형을 리사이즈할 때 도형이 옆으로 미끄러진다.** 증상이 "틀린 값"이 아니라 "조금씩 밀림"이라 놓치기 쉽다. `transform.ts`의 `resizeShapes`와 `picking.ts`의 `hitTest`가 이 패턴의 표준 사례다.

히트 테스트가 1단계만 하고 끝나는 것은, 판정 결과가 boolean이라 되돌릴 것이 없기 때문이다. 그래서 도형 모듈은 회전을 전혀 모른 채 축 정렬 검사만 한다.

## 퇴화 케이스는 조용히 틀린다

폭이나 높이가 0인 도형이 실제로 생긴다 — 수평선·수직선이 박스 모델에서 한 축이 0인 상자가 되기 때문이다. 나눗셈이 들어가는 자리마다 처리가 이미 있다.

| 자리 | 처리 |
| --- | --- |
| `transform.ts`의 `scaleExtent` | `prevSize === 0`이면 비율 대신 새 크기를 그대로 물려준다 |
| `transform.ts`의 `ratio` | 크기가 0이면 상대 위치를 한가운데(0.5)로 본다 |
| `transform.ts`의 `resizeLocalBox` | 결과 크기를 `MIN_SIZE`(1) 이상으로 자른다 |
| `geometry.ts`의 `distanceToSegment` | 길이 0인 선분은 점까지의 거리로 |
| `spatial/quadtree.ts` 생성자 | 루트 폭·높이를 최소 1로 — 0이면 자식 사분면이 전부 0이 되어 아무것도 담기지 않는다 |

**새로 나눗셈을 쓸 때는 분모가 0인 경우를 먼저 정한다.** NaN이 좌표에 한 번 들어가면 도형이 화면에서 사라지고 원인은 몇 단계 위에 있다.

## 부동소수 비교에는 epsilon

`transform.ts`의 `quarterTurns`가 "이 각도가 90°의 배수인가"를 판정하는데, 15° 스냅으로 만들어진 각도가 오차를 안고 들어오므로 `ANGLE_EPSILON`(1e-6)으로 여유를 둔다. 각도를 정확히 비교하면 스냅으로 맞춘 90°가 배수로 인정되지 않는다.

이 판정이 다중 리사이즈의 갈림길이다 — 배수면 비균등 스케일을 정확히 표현할 수 있고, 아니면 종횡비를 강제로 고정한다. 자세한 근거는 `resizeShapes`의 주석에.

## 순수성 규약

- 모든 함수는 **입력을 변형하지 않고 새 객체를 반환한다.** 씬 갱신도 얕은 복사(`{ ...scene.shapes, [id]: next }`)다. `History`가 `apply`/`invert`로 씬을 오갈 수 있는 근거다.
- `History`는 **씬을 들고 있지 않다.** 씬은 인자로 들어가고 결과로 나온다. 상태 보관은 스토어의 몫이라 협업 단계에서 히스토리를 갈아끼우기 쉽다.
- `spatial/quadtree.ts`의 `query`는 **순서를 보장하지 않는다.** z-order가 필요하면 호출부가 `index.zOf`로 정렬한다(`pickTopmost`, `pickInRect`가 그렇게 한다).

## 커맨드를 추가할 때

`commands.ts`에 `apply`/`invert` 짝을 만든다. 두 가지를 가정해야 한다.

- **그 사이 대상이 사라졌을 수 있다** — `transformShapes`가 `if (shapes[s.id])`로 걸러내는 이유. 되돌리는 사이에 삭제된 도형을 되살리면 안 된다.
- **삭제 취소는 z-order까지 되돌려야 한다** — `deleteShapes`가 `prevOrder`를 통째로 드는 이유.

## `zoom`을 받는 함수들

화면 기준 px을 월드로 환산해야 하는 함수는 `zoom`을 인자로 받는다 — `hitTest`, `hitTestLocal`, `pickHandle`, `getHandlePoints`. 판정이 카메라를 알아야 하는 유일한 이유다.

상수가 사는 곳:

| 상수 | 위치 | 단위 |
| --- | --- | --- |
| `HIT_PAD_PX` (6) | `types.ts` | 화면 px |
| `ROTATE_HANDLE_GAP` (24) | `geometry.ts` | 화면 px |
| `MIN_ZOOM` / `MAX_ZOOM` | `camera.ts` | 배율 |
| `LINE_HEIGHT_RATIO` | `types.ts` | 배수 |

`HIT_PAD_PX`가 `types.ts`에 있어야 하는 이유는 `ARCHITECTURE.md`의 불변식 3에. 이 폴더에서 그 값을 쓰는 곳은 `picking.ts`의 `queryRectAt`과 `spatial/sceneIndex.ts`의 `indexSlack` 둘이고, **둘이 함께 도형 쪽 판정 여유를 덮어야** 후보를 놓치지 않는다. `indexSlack`이 `strokeWidth`만 감당하고 화면 기준 여유는 질의하는 쪽이 넓혀서 오는 분담을 유지할 것.

`transform.ts`에도 `MIN_SIZE`가 있지만(1) `ui/CanvasView.tsx`의 `MIN_SIZE`(2)와 **다른 값·다른 뜻**이다. 전자는 리사이즈 결과의 하한, 후자는 "클릭만 하고 뗀 것"을 걸러내는 문턱이다. 한쪽을 고칠 때 다른 쪽을 따라 고치지 않는다.

## 고친 뒤 확인

`core/`에는 테스트가 없다. `geometry`·`transform`·`picking`·`spatial`을 건드렸으면 `npm run bench`를 돌린다 — 이 폴더의 변경이 깨뜨리는 것은 속도가 아니라 **판정의 정확성**이고, 화면에는 아무 표시도 나지 않는다.
