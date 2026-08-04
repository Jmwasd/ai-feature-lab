import { useEffect, useRef } from 'react'
import { panBy, screenToWorld, zoomAt } from '../core/camera'
import { addShape, deleteShapes, moveShapes, transformShapes } from '../core/commands'
import { getCenter, normalizeRect, pickHandle, type Box, type Rect } from '../core/geometry'
import { pickInRect, pickTopmost } from '../core/picking'
import { getSelectionFrame, type SelectionFrame } from '../core/selection'
import { simplifyPath } from '../core/simplify'
import { angleFrom, resizeShapes, rotateShape } from '../core/transform'
import {
  LINE_HEIGHT_RATIO,
  type ArrowStyle,
  type HandleId,
  type LineShape,
  type PathPoint,
  type PathShape,
  type Point,
  type Shape,
  type TextShape,
} from '../core/types'
import { createLayers } from '../render/layers'
import { measureTextShape } from '../render/textMetrics'
import { normalizeLine } from '../shapes/line'
import { normalizePoints } from '../shapes/path'
import { adjustAfterResize } from '../shapes/registry'
import { actions, getState, subscribeRaw, type ShapeStyle } from '../store/editorStore'

const MIN_SIZE = 2
const HANDLE_HIT_PX = 7

/** 화면 기준 값들. 줌으로 나눠 월드 단위로 환산해 쓴다 */
const PEN_TOLERANCE_PX = 1.2
/** 이 거리보다 가까운 점은 버린다. 원본 점 수를 미리 줄여둔다 */
const PEN_MIN_STEP_PX = 2

/** 선 각도 스냅. 회전과 같은 15° 간격이라 45°·90°도 함께 걸린다 */
const LINE_SNAP_STEP = Math.PI / 12

type Interaction =
  | { kind: 'idle' }
  | { kind: 'pan'; last: Point }
  | { kind: 'draw'; start: Point; type: 'rect' | 'ellipse' }
  | { kind: 'pen'; id: string; raw: PathPoint[]; width: number }
  | { kind: 'line'; id: string; start: Point; arrow: ArrowStyle; width: number }
  | { kind: 'move'; ids: string[]; last: Point; dx: number; dy: number }
  | { kind: 'resize'; handle: HandleId; box: Box; originals: Shape[] }
  | { kind: 'rotate'; original: Shape; center: Point; startAngle: number }
  | { kind: 'marquee'; start: Point; base: string[] }

function makeBoxShape(type: 'rect' | 'ellipse', rect: Rect, style: ShapeStyle): Shape {
  const base = {
    id: crypto.randomUUID(),
    ...rect,
    rotation: 0,
    fill: style.fill,
    stroke: style.stroke,
  }
  return type === 'rect' ? { ...base, type: 'rect' } : { ...base, type: 'ellipse' }
}

function makePathShape(
  id: string,
  raw: PathPoint[],
  strokeWidth: number,
  style: ShapeStyle,
): PathShape {
  return {
    id,
    type: 'path',
    ...normalizePoints(raw),
    rotation: 0,
    fill: 'transparent',
    stroke: style.stroke,
    strokeWidth,
  }
}

function makeLineShape(
  id: string,
  a: Point,
  b: Point,
  arrow: ArrowStyle,
  strokeWidth: number,
  style: ShapeStyle,
): LineShape {
  return {
    id,
    type: 'line',
    ...normalizeLine(a, b),
    rotation: 0,
    fill: 'transparent',
    stroke: style.stroke,
    strokeWidth,
    arrow,
  }
}

function makeTextShape(world: Point, fontSize: number, style: ShapeStyle): TextShape {
  return {
    id: crypto.randomUUID(),
    type: 'text',
    x: world.x,
    y: world.y,
    width: 0,
    height: fontSize * LINE_HEIGHT_RATIO,
    rotation: 0,
    fill: 'transparent',
    stroke: style.stroke,
    text: '',
    fontSize,
    fontFamily: style.fontFamily,
    align: style.align,
    wrapWidth: null,
  }
}

/**
 * 필압은 스타일러스에서만 의미가 있다.
 * 마우스는 버튼을 누른 동안 늘 0.5를 주므로 값이 있어도 정보가 없다.
 */
function pressureOf(e: PointerEvent): number | undefined {
  if (e.pointerType === 'mouse') return undefined
  return e.pressure > 0 ? e.pressure : undefined
}

/** 시작점 기준으로 각도를 15°에 맞춘다. 길이는 유지한다 */
function snapAngle(start: Point, end: Point): Point {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = Math.hypot(dx, dy)
  if (length === 0) return end
  const angle = Math.round(Math.atan2(dy, dx) / LINE_SNAP_STEP) * LINE_SNAP_STEP
  return { x: start.x + Math.cos(angle) * length, y: start.y + Math.sin(angle) * length }
}

function hasGeometryChanged(a: Shape, b: Shape): boolean {
  return (
    a.x !== b.x ||
    a.y !== b.y ||
    a.width !== b.width ||
    a.height !== b.height ||
    a.rotation !== b.rotation
  )
}

/** 핸들이 화면상 향하는 방향(도). 도형 회전각을 더해 커서를 고른다 */
const HANDLE_ANGLE: Record<string, number> = {
  n: -90,
  ne: -45,
  e: 0,
  se: 45,
  s: 90,
  sw: 135,
  w: 180,
  nw: -135,
}
const OCTANT_CURSOR = [
  'ew-resize',
  'nwse-resize',
  'ns-resize',
  'nesw-resize',
  'ew-resize',
  'nwse-resize',
  'ns-resize',
  'nesw-resize',
]

/**
 * 도형이 회전하면 핸들이 가리키는 실제 방향도 함께 돈다.
 * 회전각을 더해 8방위 중 가장 가까운 쪽의 커서를 고른다.
 */
function cursorForHandle(handle: HandleId, rotation: number): string {
  if (handle === 'rotate') return 'grab'
  const deg = HANDLE_ANGLE[handle] + (rotation * 180) / Math.PI
  const octant = ((Math.round(deg / 45) % 8) + 8) % 8
  return OCTANT_CURSOR[octant]
}

export function CanvasView() {
  const staticRef = useRef<HTMLCanvasElement>(null)
  const activeRef = useRef<HTMLCanvasElement>(null)
  const interaction = useRef<Interaction>({ kind: 'idle' })
  const spaceDown = useRef(false)

  // --- 렌더 루프: React 리렌더와 완전히 분리된다 ---
  useEffect(() => {
    const staticCanvas = staticRef.current
    const activeCanvas = activeRef.current
    if (!staticCanvas || !activeCanvas) return
    const staticCtx = staticCanvas.getContext('2d')
    const activeCtx = activeCanvas.getContext('2d')
    if (!staticCtx || !activeCtx) return

    const layers = createLayers(staticCtx, activeCtx)
    const size = { width: 0, height: 0 }
    let dpr = window.devicePixelRatio || 1
    let dirty = true
    let raf = 0

    const resize = () => {
      const rect = activeCanvas.getBoundingClientRect()
      dpr = window.devicePixelRatio || 1
      size.width = rect.width
      size.height = rect.height
      for (const canvas of [staticCanvas, activeCanvas]) {
        // CSS 픽셀이 아니라 실제 디바이스 픽셀로 백버퍼를 잡아야 고해상도에서 선명하다
        canvas.width = Math.round(rect.width * dpr)
        canvas.height = Math.round(rect.height * dpr)
      }
      // 백버퍼 크기를 지정하면 내용이 지워진다. 크기가 그대로여도 마찬가지라
      // 정적 레이어는 캐시가 유효한 줄 알고 빈 화면을 남긴다
      layers.invalidate()
      dirty = true
    }

    // 두 캔버스는 같은 자리에 겹쳐 있으므로 하나만 관찰하면 된다
    const observer = new ResizeObserver(resize)
    observer.observe(activeCanvas)
    resize()

    const unsubscribe = subscribeRaw(() => {
      dirty = true
    })

    const loop = () => {
      if (dirty) {
        layers.render(getState(), size, dpr)
        dirty = false
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
      unsubscribe()
    }
  }, [])

  // --- 휠: React의 onWheel은 passive라서 preventDefault가 먹지 않는다 ---
  useEffect(() => {
    const canvas = activeRef.current
    if (!canvas) return

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const { camera } = getState()
      const rect = canvas.getBoundingClientRect()
      const point = { x: e.clientX - rect.left, y: e.clientY - rect.top }

      if (e.ctrlKey || e.metaKey) {
        // 트랙패드 핀치도 ctrlKey가 붙은 wheel 이벤트로 들어온다
        actions.setCamera(zoomAt(camera, point, camera.zoom * Math.exp(-e.deltaY * 0.01)))
      } else {
        actions.setCamera(panBy(camera, -e.deltaX, -e.deltaY))
      }
    }

    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [])

  // --- 키보드 단축키 ---
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // 텍스트 편집 중에는 캔버스 단축키를 전부 비활성화한다.
      // 그러지 않으면 'v'를 입력하는 순간 도구가 바뀌고 Backspace가 도형을 지운다
      if (getState().editingId) return

      // 속성 패널의 입력 칸도 마찬가지다. 색상 코드에 'r'을 치면 도구가 바뀐다
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT')) return

      if (e.code === 'Space') {
        spaceDown.current = true
        // 스페이스 기본 동작(스크롤, 포커스된 버튼 재클릭)을 막는다.
        // 텍스트 도구를 추가하면 편집 중일 때는 통과시켜야 한다.
        e.preventDefault()
      }

      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) actions.redo()
        else actions.undo()
        return
      }
      if (e.key === 'Escape') {
        actions.setSelection([])
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const { scene, selection } = getState()
        if (selection.length === 0) return
        e.preventDefault()
        const removed = selection
          .map((id) => scene.shapes[id])
          .filter((s): s is Shape => Boolean(s))
        actions.execute(deleteShapes(selection, removed, scene.order))
        actions.setSelection([])
        return
      }
      // Cmd+A 같은 조합키는 도구 단축키로 새어 들어가면 안 된다
      if (mod) return
      if (e.key === 'v') actions.setTool('select')
      if (e.key === 'r') actions.setTool('rect')
      if (e.key === 'o') actions.setTool('ellipse')
      if (e.key === 'p') actions.setTool('pen')
      if (e.key === 'l') actions.setTool('line')
      if (e.key === 'a') actions.setTool('arrow')
      if (e.key === 't') actions.setTool('text')
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceDown.current = false
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  const toScreen = (e: React.PointerEvent): Point => {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  /** 조작 대상 상자. 선택 도구일 때만 핸들을 노출한다 */
  const selectionFrame = (): SelectionFrame | null => {
    const { selection, scene, tool } = getState()
    if (tool !== 'select') return null
    return getSelectionFrame(scene, selection)
  }

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)

    // 편집 중이었다면 먼저 확정한다. 캔버스는 mousedown 기본 동작을 막아 두었으므로
    // textarea에서 blur가 발생하지 않고, 여기서 명시적으로 끝내야 한다
    if (getState().editingId) actions.commitTextEditing()

    const screen = toScreen(e)
    // 확정 과정에서 도구가 바뀔 수 있으므로 그 뒤에 읽는다
    const { camera, tool, scene, selection, style } = getState()
    const world = screenToWorld(screen, camera)

    // 스페이스 + 드래그, 휠 클릭은 도구와 무관하게 항상 팬
    if (spaceDown.current || e.button === 1) {
      interaction.current = { kind: 'pan', last: screen }
      e.currentTarget.style.cursor = 'grabbing'
      return
    }

    if (tool === 'text') {
      // 확정 전까지 draft에 두고 편집기를 띄운다. 빈 채로 끝나면 그대로 버린다
      const shape = makeTextShape(world, style.fontSize / camera.zoom, style)
      actions.setDraft(shape)
      actions.startTextEditing(shape)
      interaction.current = { kind: 'idle' }
      return
    }

    if (tool === 'pen') {
      const id = crypto.randomUUID()
      const width = style.strokeWidth / camera.zoom
      const first: PathPoint = { ...world, pressure: pressureOf(e.nativeEvent) }
      interaction.current = { kind: 'pen', id, raw: [first], width }
      actions.setDraft(makePathShape(id, [first], width, style))
      return
    }

    if (tool === 'line' || tool === 'arrow') {
      const id = crypto.randomUUID()
      const arrow: ArrowStyle = tool === 'arrow' ? 'end' : 'none'
      const width = style.strokeWidth / camera.zoom
      interaction.current = { kind: 'line', id, start: world, arrow, width }
      actions.setDraft(makeLineShape(id, world, world, arrow, width, style))
      return
    }

    if (tool === 'rect' || tool === 'ellipse') {
      interaction.current = { kind: 'draw', start: world, type: tool }
      actions.setDraft(makeBoxShape(tool, { x: world.x, y: world.y, width: 0, height: 0 }, style))
      return
    }

    // 핸들 검사가 도형 히트보다 먼저다. 핸들은 도형 경계 밖에 걸쳐 있다
    const frame = selectionFrame()
    if (frame) {
      const handle = pickHandle(frame.box, world, HANDLE_HIT_PX, camera.zoom, frame.rotatable)
      if (handle === 'rotate') {
        // 회전 핸들은 단일 선택에서만 나오므로 대상 도형도 하나뿐이다
        const target = frame.shapes[0]
        const center = getCenter(target)
        interaction.current = {
          kind: 'rotate',
          original: target,
          center,
          startAngle: angleFrom(center, world),
        }
        actions.setActive([target.id])
        return
      }
      if (handle) {
        interaction.current = { kind: 'resize', handle, box: frame.box, originals: frame.shapes }
        actions.setActive(frame.shapes.map((s) => s.id))
        return
      }
    }

    const hit = pickTopmost(scene, world, camera.zoom)
    if (hit) {
      if (e.shiftKey) {
        // 토글만 하고 이동은 시작하지 않는다. 선택을 다듬는 동작과 옮기는 동작을 섞지 않기 위해서
        const next = selection.includes(hit.id)
          ? selection.filter((id) => id !== hit.id)
          : [...selection, hit.id]
        actions.setSelection(next)
        interaction.current = { kind: 'idle' }
        return
      }
      const ids = selection.includes(hit.id) ? selection : [hit.id]
      if (!selection.includes(hit.id)) actions.setSelection(ids)
      interaction.current = { kind: 'move', ids, last: world, dx: 0, dy: 0 }
      // 이제부터 포인터를 뗄 때까지 바뀌는 도형은 이것들뿐이라는 선언.
      // 정적 레이어는 이 도형들을 빼고 한 번 그린 뒤 드래그 내내 그대로 있는다
      actions.setActive(ids)
      return
    }

    // 빈 곳 드래그는 마퀴 선택. 화면 이동은 스페이스나 휠에 맡긴다
    interaction.current = { kind: 'marquee', start: world, base: e.shiftKey ? selection : [] }
    if (!e.shiftKey) actions.setSelection([])
  }

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const current = interaction.current
    const screen = toScreen(e)
    const { camera, scene, style } = getState()

    if (current.kind === 'idle') {
      // 핸들 위에 올라오면 방향에 맞는 커서를 보여준다
      const frame = selectionFrame()
      if (frame) {
        const world = screenToWorld(screen, camera)
        const handle = pickHandle(frame.box, world, HANDLE_HIT_PX, camera.zoom, frame.rotatable)
        e.currentTarget.style.cursor = handle ? cursorForHandle(handle, frame.box.rotation) : ''
      } else if (e.currentTarget.style.cursor) {
        e.currentTarget.style.cursor = ''
      }
      return
    }

    if (current.kind === 'pan') {
      actions.setCamera(panBy(camera, screen.x - current.last.x, screen.y - current.last.y))
      current.last = screen
      return
    }

    const world = screenToWorld(screen, camera)

    if (current.kind === 'pen') {
      /*
       * 브라우저는 화면 갱신 주기보다 자주 들어온 포인터 이벤트를 하나로 합쳐서
       * 전달한다. 빠르게 그으면 그 사이의 위치가 통째로 버려져 획이 각진다.
       * `getCoalescedEvents()`로 합쳐지기 전의 원본을 꺼내 전부 반영한다.
       */
      const native = e.nativeEvent
      const coalesced = native.getCoalescedEvents?.() ?? []
      const samples = coalesced.length > 0 ? coalesced : [native]

      const rect = e.currentTarget.getBoundingClientRect()
      const minStep = PEN_MIN_STEP_PX / camera.zoom
      let added = false
      for (const sample of samples) {
        const p = screenToWorld(
          { x: sample.clientX - rect.left, y: sample.clientY - rect.top },
          camera,
        )
        const last = current.raw[current.raw.length - 1]
        // 너무 촘촘한 점은 애초에 받지 않는다. 뒤의 단순화가 할 일을 줄여준다
        if (Math.hypot(p.x - last.x, p.y - last.y) < minStep) continue
        current.raw.push({ ...p, pressure: pressureOf(sample) })
        added = true
      }

      if (added) actions.setDraft(makePathShape(current.id, current.raw, current.width, style))
      return
    }

    if (current.kind === 'line') {
      const end = e.shiftKey ? snapAngle(current.start, world) : world
      actions.setDraft(
        makeLineShape(current.id, current.start, end, current.arrow, current.width, style),
      )
      return
    }

    if (current.kind === 'draw') {
      const rect = normalizeRect(current.start, world)
      const draft = getState().draft
      if (draft) actions.setDraft({ ...draft, ...rect })
      return
    }

    if (current.kind === 'resize') {
      // 항상 원본에서 다시 계산한다. 직전 결과를 누적하면 오차가 쌓이고
      // 드래그 도중 Shift를 눌렀다 떼는 동작을 되돌릴 수 없다
      const resized = resizeShapes(current.originals, current.box, current.handle, world, {
        keepAspect: e.shiftKey,
        fromCenter: e.altKey,
      })
      const shapes = { ...scene.shapes }
      resized.forEach((next, i) => {
        // 텍스트처럼 박스만 바꿔서는 안 되는 도형을 여기서 손본다.
        // 어느 핸들을 끌었는지와 글자 크기를 재는 방법을 함께 넘긴다
        const adjusted = adjustAfterResize(next, current.originals[i], {
          handle: current.handle,
          measureTextShape,
        })
        shapes[adjusted.id] = adjusted
      })
      actions.setScene({ ...scene, shapes })
      return
    }

    if (current.kind === 'rotate') {
      const next = rotateShape(
        current.original,
        current.startAngle,
        angleFrom(current.center, world),
        e.shiftKey,
      )
      actions.setScene({ ...scene, shapes: { ...scene.shapes, [next.id]: next } })
      return
    }

    if (current.kind === 'marquee') {
      const rect = normalizeRect(current.start, world)
      actions.setMarquee(rect)
      const inside = pickInRect(scene, rect)
      const merged = current.base.length ? [...new Set([...current.base, ...inside])] : inside
      actions.setSelection(merged)
      return
    }

    // move: 드래그 중에는 씬을 직접 갱신하고 히스토리는 건드리지 않는다
    const dx = world.x - current.last.x
    const dy = world.y - current.last.y
    const shapes = { ...scene.shapes }
    for (const id of current.ids) {
      const s = shapes[id]
      if (s) shapes[id] = { ...s, x: s.x + dx, y: s.y + dy }
    }
    actions.setScene({ ...scene, shapes })
    current.last = world
    current.dx += dx
    current.dy += dy
  }

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId)
    e.currentTarget.style.cursor = ''
    const current = interaction.current
    interaction.current = { kind: 'idle' }
    // 조작이 끝났으니 도형을 정적 레이어로 돌려보낸다. 아무것도 잡지 않았던
    // 조작(팬·마퀴)이면 이 호출은 아무 일도 하지 않는다
    actions.setActive([])

    if (current.kind === 'pen') {
      actions.setDraft(null)
      const { camera, style } = getState()
      // 단순화는 획이 끝난 뒤 한 번만. 그리는 도중에 하면 선이 계속 요동친다
      const simplified = simplifyPath(current.raw, PEN_TOLERANCE_PX / camera.zoom)
      if (simplified.length < 2) return
      const shape = makePathShape(current.id, simplified, current.width, style)
      actions.execute(addShape(shape))
      // 펜은 연속으로 긋는 경우가 많아 도구를 유지한다
      return
    }

    if (current.kind === 'line') {
      const draft = getState().draft
      actions.setDraft(null)
      // 박스의 대각선 길이가 곧 선의 길이다. 수평선처럼 한 축이 0인 경우도 걸러지지 않는다
      if (draft?.type === 'line' && Math.hypot(draft.width, draft.height) >= MIN_SIZE) {
        actions.execute(addShape(draft))
        actions.setTool('select')
        actions.setSelection([draft.id])
      }
      return
    }

    if (current.kind === 'draw') {
      const draft = getState().draft
      actions.setDraft(null)
      // 클릭만 하고 뗀 경우는 도형을 만들지 않는다
      if (draft && draft.width >= MIN_SIZE && draft.height >= MIN_SIZE) {
        actions.execute(addShape(draft))
        // 그린 직후 선택 도구로 넘어가야 바로 이어서 옮길 수 있다
        actions.setTool('select')
        actions.setSelection([draft.id])
      }
      return
    }

    if (current.kind === 'marquee') {
      actions.setMarquee(null)
      return
    }

    if (current.kind === 'resize') {
      const { shapes } = getState().scene
      const before: Shape[] = []
      const after: Shape[] = []
      for (const original of current.originals) {
        const next = shapes[original.id]
        // 참조 비교로는 포인터가 1px만 흔들려도 기록된다. 실제 값이 변했을 때만 남긴다
        if (next && hasGeometryChanged(original, next)) {
          before.push(original)
          after.push(next)
        }
      }
      if (before.length > 0) actions.record(transformShapes(before, after))
      return
    }

    if (current.kind === 'rotate') {
      const after = getState().scene.shapes[current.original.id]
      if (after && hasGeometryChanged(current.original, after)) {
        actions.record(transformShapes([current.original], [after]))
      }
      return
    }

    if (current.kind === 'move' && (current.dx !== 0 || current.dy !== 0)) {
      // 이동은 이미 반영되어 있으므로 히스토리에만 한 번 기록
      actions.record(moveShapes(current.ids, current.dx, current.dy))
    }
  }

  /** 텍스트를 다시 편집하는 통로. 도형 위 더블클릭이 표준 조작이다 */
  const onDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { camera, scene, tool } = getState()
    if (tool !== 'select') return
    const rect = e.currentTarget.getBoundingClientRect()
    const world = screenToWorld({ x: e.clientX - rect.left, y: e.clientY - rect.top }, camera)
    const hit = pickTopmost(scene, world, camera.zoom)
    if (hit?.type === 'text') {
      actions.setSelection([hit.id])
      actions.startTextEditing(hit)
    }
  }

  /*
   * 캔버스 두 장을 같은 자리에 겹친다. 아래는 움직이지 않는 도형(정적 레이어),
   * 위는 조작 중인 도형·draft·선택 UI(활성 레이어)다. 합치는 일은 브라우저
   * 컴포지터가 하므로 JS는 바뀐 레이어만 다시 그리면 된다.
   *
   * 포인터 이벤트는 늘 위쪽 캔버스가 받는다 — 좌표 계산이 한 요소 기준으로
   * 고정되어야 `getBoundingClientRect` 결과가 갈리지 않는다.
   */
  return (
    <>
      <canvas ref={staticRef} className="canvas canvas-static" aria-hidden="true" />
      <canvas
        ref={activeRef}
        className="canvas canvas-active"
        /*
         * mousedown의 기본 동작은 포커스를 옮기는 것이다. 그대로 두면 텍스트를
         * 만들자마자 방금 띄운 textarea가 포커스를 잃고 편집이 취소된다.
         * 캔버스 자체는 포커스를 받을 일이 없고 키 입력은 window에서 듣는다.
         */
        onMouseDown={(e) => e.preventDefault()}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
        onContextMenu={(e) => e.preventDefault()}
      />
    </>
  )
}
