import type { Camera, Shape } from '../core/types'
import type { EditorState } from '../store/editorStore'
import { drawActiveLayer, drawStaticLayer, type ViewSize } from './renderer'

/**
 * 정적 레이어 / 활성 레이어 분리.
 *
 * 캔버스를 둘 겹쳐 놓고 아래에는 **움직이지 않는 도형**을, 위에는 **지금
 * 조작 중인 것**만 그린다. 도형 하나를 끄는 동안 나머지 수천 개는 픽셀 한 점
 * 바뀌지 않는데도 매 프레임 다시 그려지던 비용이 여기서 사라진다.
 *
 * 정적 레이어를 캐시하면 매 프레임 도는 컬링 순회도 함께 사라진다 — 도형 수에
 * 비례하던 유일한 프레임 비용이 "움직이는 것의 개수"로 줄어든다.
 *
 * **대신 정적 레이어가 언제 낡는지를 정확히 알아야 한다.** 늦게 알아채면 화면에
 * 옛 픽셀이 남고, 아무 오류도 나지 않는다. 판단 근거는 `StaticKey` 하나뿐이다.
 */

/**
 * 정적 레이어를 다시 그려야 하는지 판단하는 입력 전부.
 *
 * **여기 없는 값이 정적 레이어를 바꾸면 화면에 잔상이 남는다.** `scene`이 아니라
 * `staticEpoch`를 보는 것이 핵심이다 — 드래그 중에는 매 프레임 새 씬이
 * 만들어지지만 바뀐 것은 활성 집합뿐이고, 그 구분을 아는 것은 스토어다
 * (`store/editorStore.ts`의 `staticEpoch`).
 */
type StaticKey = {
  epoch: number
  camera: Camera
  active: readonly string[]
  editingId: string | null
  width: number
  height: number
  dpr: number
}

export type Layers = {
  render(state: EditorState, size: ViewSize, dpr: number): void
  /** 백버퍼가 날아갔을 때(캔버스 크기 재설정) 다음 프레임에 정적 레이어를 다시 그리게 한다 */
  invalidate(): void
}

export function createLayers(
  staticCtx: CanvasRenderingContext2D,
  activeCtx: CanvasRenderingContext2D,
): Layers {
  let key: StaticKey | null = null

  /*
   * 활성 집합에서 파생되는 두 가지. 집합이 바뀔 때만(= 드래그를 시작하고 끝낼
   * 때만) 다시 만든다. 매 프레임 Set을 만들면 레이어를 나눠 아낀 것을 할당으로
   * 도로 내놓는다.
   */
  let activeSource: readonly string[] | null = null
  let activeSet: ReadonlySet<string> = new Set<string>()
  let activeOrdered: string[] = []

  const syncActive = (state: EditorState): void => {
    if (state.active === activeSource) return
    activeSource = state.active
    activeSet = new Set(state.active)

    if (state.active.length <= 1) {
      activeOrdered = state.active.slice()
      return
    }
    // 함께 끌려가는 도형들끼리는 z-order를 지켜야 겹칠 때 앞뒤가 뒤집히지 않는다.
    // 씬 전체를 훑지만 드래그 한 번에 한 번이라 프레임 비용이 아니다
    const rank = new Map<string, number>()
    for (let z = 0; z < state.scene.order.length; z++) rank.set(state.scene.order[z], z)
    activeOrdered = state.active.slice().sort((a, b) => (rank.get(a) ?? -1) - (rank.get(b) ?? -1))
  }

  const isStale = (state: EditorState, size: ViewSize, dpr: number): boolean =>
    key === null ||
    key.epoch !== state.staticEpoch ||
    key.camera !== state.camera ||
    key.active !== state.active ||
    key.editingId !== state.editingId ||
    key.width !== size.width ||
    key.height !== size.height ||
    key.dpr !== dpr

  return {
    render(state, size, dpr) {
      syncActive(state)

      const redraw = isStale(state, size, dpr)
      if (redraw) {
        drawStaticLayer(staticCtx, state, size, dpr, activeSet)
        key = {
          epoch: state.staticEpoch,
          camera: state.camera,
          active: state.active,
          editingId: state.editingId,
          width: size.width,
          height: size.height,
          dpr,
        }
      }

      drawActiveLayer(activeCtx, state, size, dpr, activeOrdered)

      if (import.meta.env.DEV) checkContract(state, redraw, activeSet)
    },

    invalidate() {
      key = null
    },
  }
}

/*
 * 계약 위반 감지 — 개발 빌드에서만 돈다.
 *
 * 정적 레이어를 건너뛰는 근거는 "활성 집합이 선언된 동안 바뀌는 도형은 그
 * 집합뿐"이라는 계약이다. 집합 밖의 도형이 그때 바뀌면 화면에는 옛 픽셀이
 * 남는데, **느려지는 것이 아니라 조용히 틀리는 종류의 실패라** 눈으로는
 * 알아채기 어렵다(`ARCHITECTURE.md`의 불변식 4와 같은 성질이다).
 *
 * 프로덕션은 O(1)로 믿고 지나가고, 여기서만 실제로 대조한다. 드래그 중에만
 * 도형 수만큼 참조를 비교하므로 개발 중 체감되는 비용은 없다.
 */
let prevShapes: Record<string, Shape> | null = null
let warned = false

function checkContract(
  state: EditorState,
  redrew: boolean,
  active: ReadonlySet<string>,
): void {
  const shapes = state.scene.shapes
  const previous = prevShapes
  prevShapes = shapes
  // 정적 레이어를 방금 다시 그렸으면 무엇이 바뀌었든 화면은 맞는다
  if (warned || redrew || previous === null || previous === shapes) return

  for (const id of state.scene.order) {
    if (shapes[id] === previous[id] || active.has(id)) continue
    warned = true
    console.warn(
      `[layers] 활성 집합 밖의 도형(${id})이 바뀌었는데 정적 레이어를 다시 그리지 않았습니다.\n` +
        '화면에는 옛 픽셀이 남습니다. 바뀔 도형을 actions.setActive로 미리 선언하거나,\n' +
        'actions.setScene 대신 히스토리를 거치는 경로(execute/undo/redo)를 쓰세요.',
    )
    return
  }
}
