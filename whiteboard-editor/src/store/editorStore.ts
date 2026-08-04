import { useSyncExternalStore } from 'react'
import { addShape, deleteShapes, transformShapes, type Command } from '../core/commands'
import type { Rect } from '../core/geometry'
import { History } from '../core/history'
import {
  createEmptyScene,
  type Camera,
  type Scene,
  type Shape,
  type TextAlign,
  type TextShape,
  type ToolId,
} from '../core/types'

/**
 * 앞으로 만들 도형에 적용할 스타일.
 *
 * 굵기와 글자 크기는 **화면 기준 px**이다. 도형을 만들 때 zoom으로 나눠
 * 월드 단위로 환산하므로, 어느 배율에서 그리든 화면에 보이는 크기가 같다.
 * 이미 만들어진 도형의 값은 월드 단위라, 속성 패널에서 선택한 도형을
 * 편집할 때와 기본값을 편집할 때 같은 숫자가 서로 다른 단위를 뜻한다.
 */
export type ShapeStyle = {
  fill: string
  stroke: string
  strokeWidth: number
  fontSize: number
  fontFamily: string
  align: TextAlign
}

const DEFAULT_STYLE: ShapeStyle = {
  fill: '#3b4252',
  stroke: '#cbd3e1',
  strokeWidth: 2,
  fontSize: 16,
  fontFamily: 'system-ui, -apple-system, sans-serif',
  align: 'left',
}

export type EditorState = {
  scene: Scene
  camera: Camera
  tool: ToolId
  selection: string[]
  /** 새로 만드는 도형에 쓸 스타일. 선택이 없을 때 속성 패널이 이걸 편집한다 */
  style: ShapeStyle
  /** 생성 중인 도형. 확정 전까지 씬에 넣지 않아 히스토리를 더럽히지 않는다 */
  draft: Shape | null
  /** 드래그 중인 마퀴 선택 영역 (월드 좌표) */
  marquee: Rect | null
  /** 텍스트 편집 중인 도형 id. 씬에 있을 수도, 아직 draft일 수도 있다 */
  editingId: string | null
  /** 편집 시작 시점의 스냅샷. 히스토리에 되돌릴 지점을 남기려면 필요하다 */
  editingOriginal: TextShape | null
  /**
   * 지금 조작 중이라 활성 레이어가 맡은 도형들.
   *
   * 드래그를 시작하고 끝낼 때만 바뀌므로 매 프레임 바뀌는 값이 아니다.
   * 이 목록은 곧 **"지금부터 포인터를 뗄 때까지 바뀔 수 있는 도형은 이것뿐"**
   * 이라는 선언이고, `setScene`이 정적 레이어를 건드리지 않는 근거가 된다.
   */
  active: string[]
  /**
   * 정적 레이어를 다시 그려야 할 때마다 오르는 카운터.
   *
   * 렌더러가 `scene` 참조만 보고 판단할 수 없어서 있다 — 드래그 중에는 매 프레임
   * 새 씬이 만들어지지만 바뀐 것은 `active`뿐이고, **어떤 종류의 변경인지 아는
   * 것은 스토어뿐이다.** 불변식 5의 3분기(execute/setScene/record)가 그대로
   * 여기로 이어진다: `setScene`은 활성 집합이 선언돼 있을 때만 건너뛴다.
   */
  staticEpoch: number
  canUndo: boolean
  canRedo: boolean
}

const history = new History()

let state: EditorState = {
  scene: createEmptyScene(),
  camera: { x: 0, y: 0, zoom: 1 },
  tool: 'rect',
  selection: [],
  style: DEFAULT_STYLE,
  draft: null,
  marquee: null,
  editingId: null,
  editingOriginal: null,
  active: [],
  staticEpoch: 0,
  canUndo: false,
  canRedo: false,
}

/** 편집 중인 도형. 새로 만드는 중이면 draft에, 기존 도형이면 씬에 있다 */
export function getEditingShape(state: EditorState): Shape | null {
  if (!state.editingId) return null
  if (state.draft?.id === state.editingId) return state.draft
  return state.scene.shapes[state.editingId] ?? null
}

const listeners = new Set<() => void>()

export function getState(): EditorState {
  return state
}

export function setState(patch: Partial<EditorState>): void {
  state = { ...state, ...patch }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * selector는 반드시 참조가 안정적인 값(원시값이나 기존 객체 참조)을 반환해야 한다.
 * 매번 새 객체/배열을 만들어 반환하면 useSyncExternalStore가 무한 루프에 빠진다.
 */
export function useEditor<T>(selector: (s: EditorState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state))
}

/** 캔버스 렌더 루프처럼 React 밖에서 상태 변경을 감지해야 할 때 */
export const subscribeRaw = subscribe

function syncHistoryFlags(): Partial<EditorState> {
  return { canUndo: history.canUndo, canRedo: history.canRedo }
}

/**
 * 정적 레이어를 낡은 것으로 표시한다.
 *
 * **씬을 바꾸는 모든 경로가 이걸 거친다.** 예외는 활성 집합이 선언된 동안의
 * `setScene` 하나뿐이고, 예외가 하나라서 기억할 수 있다. 빠뜨리면 화면에
 * 잔상이 남고 아무 오류도 나지 않는다 — 개발 빌드에서는 `render/layers.ts`의
 * 계약 검사가 콘솔로 알려준다.
 */
function invalidateStatic(): Partial<EditorState> {
  return { staticEpoch: state.staticEpoch + 1 }
}

// 개발 중 콘솔이나 자동화에서 상태를 들여다보기 위한 통로
if (import.meta.env.DEV) {
  ;(window as unknown as Record<string, unknown>).__editor = {
    getState,
    getEditingShape: () => getEditingShape(state),
  }
}

export const actions = {
  setTool(tool: ToolId) {
    setState({ tool, selection: tool === 'select' ? state.selection : [] })
  },

  setCamera(camera: Camera) {
    setState({ camera })
  },

  setSelection(selection: string[]) {
    setState({ selection })
  },

  setStyle(patch: Partial<ShapeStyle>) {
    setState({ style: { ...state.style, ...patch } })
  },

  setDraft(draft: Shape | null) {
    setState({ draft })
  },

  setMarquee(marquee: Rect | null) {
    setState({ marquee })
  },

  /**
   * 활성 레이어가 맡을 도형을 선언한다. 조작을 시작할 때 넣고 끝낼 때 비운다.
   *
   * 둘 다 비어 있으면 아무것도 하지 않는다 — 팬이나 마퀴처럼 도형을 잡지 않은
   * 조작이 끝날 때마다 정적 레이어를 통째로 다시 그리게 만들지 않기 위해서다.
   */
  setActive(active: string[]) {
    if (active.length === 0 && state.active.length === 0) return
    setState({ active })
  },

  startTextEditing(shape: TextShape) {
    setState({ editingId: shape.id, editingOriginal: shape })
  },

  /** 편집 중인 텍스트를 제자리에서 갱신. 씬이든 draft든 같은 방식으로 다룬다 */
  updateEditingShape(shape: Shape) {
    if (state.draft?.id === shape.id) {
      setState({ draft: shape })
      return
    }
    setState({
      scene: { ...state.scene, shapes: { ...state.scene.shapes, [shape.id]: shape } },
      // 편집 중인 도형은 정적 레이어에서 이미 빠져 있어 실은 다시 그릴 게 없다.
      // 그래도 무효화하는 것은 예외를 하나로 유지하기 위해서다 — 타자 속도로
      // 도는 경로라 전체 렌더 한 번이 붙어도 체감되지 않는다
      ...invalidateStatic(),
    })
  },

  /**
   * 텍스트 편집을 끝내고 결과를 확정한다.
   *
   * 편집기 컴포넌트가 아니라 여기에 두는 이유는, 캔버스의 다른 곳을 클릭해
   * 편집을 끝내는 경로에서도 같은 처리가 필요하기 때문이다.
   * 여러 번 불려도 안전하다.
   */
  commitTextEditing() {
    const snapshot = state
    if (!snapshot.editingId) return

    const current = getEditingShape(snapshot)
    const original = snapshot.editingOriginal
    const isDraft = snapshot.draft?.id === snapshot.editingId

    setState({ editingId: null, editingOriginal: null })
    if (!current || current.type !== 'text') return

    const isEmpty = current.text.trim().length === 0

    if (isDraft) {
      setState({ draft: null })
      // 도구만 고르고 아무것도 입력하지 않았으면 도형을 만들지 않는다
      if (isEmpty) return
      actions.execute(addShape(current))
      actions.setTool('select')
      actions.setSelection([current.id])
      return
    }

    if (isEmpty) {
      actions.execute(deleteShapes([current.id], [current], snapshot.scene.order))
      actions.setSelection([])
      return
    }

    if (original && original.text !== current.text) {
      // 입력은 이미 씬에 반영되어 있으므로 히스토리에만 기록
      actions.record(transformShapes([original], [current]))
    }
  },

  /**
   * 씬을 직접 갱신 (드래그 중처럼 히스토리에 남기지 않는 변경).
   *
   * 활성 집합이 선언돼 있으면 바뀐 것은 그 도형들뿐이라는 계약이므로 정적
   * 레이어를 낡았다고 표시하지 않는다. **드래그 중 매 프레임 도는 유일한
   * 경로라, 여기서 무효화하면 레이어를 나눈 이득이 통째로 사라진다.**
   *
   * 반대로 속성 패널의 색상 미리보기처럼 활성 집합 없이 씬을 고치는 경우는
   * 무엇이 바뀌었는지 알 수 없으니 전부 다시 그린다.
   */
  setScene(scene: Scene) {
    setState({ scene, ...(state.active.length > 0 ? null : invalidateStatic()) })
  },

  execute(cmd: Command) {
    setState({
      scene: history.execute(cmd, state.scene),
      ...syncHistoryFlags(),
      ...invalidateStatic(),
    })
  },

  /** 이미 반영된 변경을 히스토리에만 기록 */
  record(cmd: Command) {
    history.push(cmd)
    setState(syncHistoryFlags())
  },

  undo() {
    setState({
      scene: history.undo(state.scene),
      selection: [],
      ...syncHistoryFlags(),
      ...invalidateStatic(),
    })
  },

  redo() {
    setState({
      scene: history.redo(state.scene),
      selection: [],
      ...syncHistoryFlags(),
      ...invalidateStatic(),
    })
  },
}
