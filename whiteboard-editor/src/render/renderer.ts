import {
  getCenter,
  getHandlePoints,
  getWorldBounds,
  ROTATE_HANDLE_GAP,
  type Box,
  type Rect,
} from '../core/geometry'
import { getSelectionFrame } from '../core/selection'
import { RESIZE_HANDLES, type Camera, type Shape } from '../core/types'
import { drawShapeBody } from '../shapes/render'
import { renderPadOf } from '../shapes/registry'
import type { EditorState } from '../store/editorStore'

const GRID_BASE = 32
const GRID_COLOR = '#2a2d35'
const SELECTION_COLOR = '#4c8dff'
const HANDLE_FILL = '#ffffff'
const BACKGROUND = '#1b1d23'

/** 화면 기준 크기. 줌으로 나눠 월드 크기로 환산해 쓴다 */
const HANDLE_SIZE = 8
const ROTATE_HANDLE_RADIUS = 5

/** 회전을 적용한 상태로 콜백을 실행하고 원래 변환으로 되돌린다 */
function withRotation(
  ctx: CanvasRenderingContext2D,
  center: { x: number; y: number },
  rotation: number,
  draw: () => void,
): void {
  if (rotation === 0) {
    draw()
    return
  }
  ctx.save()
  ctx.translate(center.x, center.y)
  ctx.rotate(rotation)
  ctx.translate(-center.x, -center.y)
  draw()
  ctx.restore()
}

/**
 * 회전만 여기서 걸고, 실제 모양은 도형 모듈에 맡긴다.
 * 도형 종류가 늘어나도 이 파일은 바뀌지 않는다.
 */
function drawShape(ctx: CanvasRenderingContext2D, shape: Shape, zoom: number): void {
  withRotation(ctx, getCenter(shape), shape.rotation, () => {
    drawShapeBody(ctx, shape, zoom)
  })
}

/** 현재 화면이 덮는 월드 사각형 */
export function viewportWorldRect(cam: Camera, w: number, h: number): Rect {
  return { x: cam.x, y: cam.y, width: w / cam.zoom, height: h / cam.zoom }
}

/**
 * 화면 밖 도형 건너뛰기.
 *
 * 도형이 1만 개여도 화면에 걸리는 것은 보통 수백 개다. 나머지는 Canvas가
 * 알아서 잘라내지만, **잘라내기 전에 경로를 다 쌓는 비용은 그대로 든다.**
 * 펜 획 하나가 수십 개의 `quadraticCurveTo`라 이 비용이 지배적이다.
 *
 * `rectsIntersect`를 쓰지 않고 직접 비교하는 이유는 사각형 객체를 만들지 않기
 * 위해서다. 매 프레임 도형마다 한 번씩이면 1만 개 × 60fps = 초당 60만 개다.
 */
export function isVisible(shape: Shape, view: Rect, zoom: number): boolean {
  const b = getWorldBounds(shape)
  const pad = renderPadOf(shape, zoom)
  return (
    b.x - pad < view.x + view.width &&
    b.x + b.width + pad > view.x &&
    b.y - pad < view.y + view.height &&
    b.y + b.height + pad > view.y
  )
}

/** 화면에 보이는 영역만 그린다. 월드 전체를 순회하면 줌아웃 시 즉시 죽는다 */
function drawGrid(ctx: CanvasRenderingContext2D, cam: Camera, w: number, h: number): void {
  let step = GRID_BASE
  while (step * cam.zoom < 16) step *= 4

  const right = cam.x + w / cam.zoom
  const bottom = cam.y + h / cam.zoom

  ctx.fillStyle = GRID_COLOR
  const dot = 1 / cam.zoom
  for (let x = Math.floor(cam.x / step) * step; x < right; x += step) {
    for (let y = Math.floor(cam.y / step) * step; y < bottom; y += step) {
      ctx.fillRect(x, y, dot, dot)
    }
  }
}

function drawOutline(ctx: CanvasRenderingContext2D, shape: Shape, zoom: number): void {
  withRotation(ctx, getCenter(shape), shape.rotation, () => {
    ctx.strokeStyle = SELECTION_COLOR
    ctx.lineWidth = 1 / zoom
    ctx.strokeRect(shape.x, shape.y, shape.width, shape.height)
  })
}

/**
 * 리사이즈·회전 핸들.
 * 핸들은 상자와 함께 기울어져야 조작 방향과 시각이 일치한다.
 *
 * 회전 핸들은 `withRotate`일 때만 그린다. 다중 선택의 공통 박스는 아직
 * 통째로 회전할 수 없어서, 그려두면 동작하지 않는 손잡이가 된다.
 */
function drawHandles(
  ctx: CanvasRenderingContext2D,
  box: Box,
  zoom: number,
  withRotate: boolean,
): void {
  const points = getHandlePoints(box, ROTATE_HANDLE_GAP, zoom)
  const size = HANDLE_SIZE / zoom
  const line = 1 / zoom

  ctx.strokeStyle = SELECTION_COLOR
  ctx.lineWidth = line

  // 회전 핸들로 이어지는 연결선
  if (withRotate) {
    ctx.beginPath()
    ctx.moveTo(points.n.x, points.n.y)
    ctx.lineTo(points.rotate.x, points.rotate.y)
    ctx.stroke()
  }

  ctx.fillStyle = HANDLE_FILL
  for (const id of RESIZE_HANDLES) {
    const p = points[id]
    withRotation(ctx, p, box.rotation, () => {
      ctx.beginPath()
      ctx.rect(p.x - size / 2, p.y - size / 2, size, size)
      ctx.fill()
      ctx.stroke()
    })
  }

  if (!withRotate) return
  ctx.beginPath()
  ctx.arc(points.rotate.x, points.rotate.y, ROTATE_HANDLE_RADIUS / zoom, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
}

function drawMarquee(ctx: CanvasRenderingContext2D, rect: Rect, zoom: number): void {
  ctx.fillStyle = 'rgba(76, 141, 255, 0.12)'
  ctx.strokeStyle = SELECTION_COLOR
  ctx.lineWidth = 1 / zoom
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height)
  ctx.strokeRect(rect.x, rect.y, rect.width, rect.height)
}

function drawGroupBounds(ctx: CanvasRenderingContext2D, bounds: Rect, zoom: number): void {
  ctx.strokeStyle = SELECTION_COLOR
  ctx.lineWidth = 1 / zoom
  ctx.setLineDash([4 / zoom, 3 / zoom])
  ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height)
  ctx.setLineDash([])
}

export type ViewSize = { width: number; height: number }

/**
 * 배경을 처리하고 월드 좌표계로 진입한다. 반환값은 컬링에 쓸 화면 사각형.
 *
 * `opaque`가 false면 칠하는 대신 **지운다.** 활성 레이어는 정적 레이어 위에
 * 겹치는 캔버스라, 배경색으로 칠하면 아래에 있는 도형이 통째로 가려진다.
 */
function enterWorld(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  size: ViewSize,
  dpr: number,
  opaque: boolean,
): Rect {
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  if (opaque) {
    ctx.fillStyle = BACKGROUND
    ctx.fillRect(0, 0, size.width * dpr, size.height * dpr)
  } else {
    ctx.clearRect(0, 0, size.width * dpr, size.height * dpr)
  }

  // 월드 → 스크린 변환을 한 번에 걸고, 이후 도형은 전부 월드 좌표로 그린다
  const s = dpr * camera.zoom
  ctx.setTransform(s, 0, 0, s, -camera.x * s, -camera.y * s)

  return viewportWorldRect(camera, size.width, size.height)
}

/**
 * 선택 프레임과 마퀴.
 *
 * 레이어를 나눠도 이건 늘 활성 쪽에만 있다. 어차피 모든 도형 위에 그려지는
 * 것이라 정적 레이어에 남겨둘 이유가 없고, 선택이 바뀔 때마다 정적 레이어를
 * 다시 그리게 만들면 레이어를 나눈 의미가 사라진다.
 */
function drawOverlay(ctx: CanvasRenderingContext2D, state: EditorState): void {
  const { camera, scene, selection, marquee } = state

  const frame = getSelectionFrame(scene, selection)
  if (frame) {
    for (const shape of frame.shapes) drawOutline(ctx, shape, camera.zoom)
    // 여럿을 고르면 공통 박스가 조작 대상이라는 것을 점선으로 구분해 보여준다.
    // 하나뿐일 때는 도형 외곽선이 곧 상자라 겹쳐 그릴 필요가 없다
    if (!frame.rotatable) drawGroupBounds(ctx, frame.box, camera.zoom)
    drawHandles(ctx, frame.box, camera.zoom, frame.rotatable)
  }

  if (marquee) drawMarquee(ctx, marquee, camera.zoom)
}

/**
 * 한 프레임 전체를 캔버스 하나에 그린다.
 *
 * 앱은 이 경로 대신 `render/layers.ts`의 두 레이어로 그린다. 여기가 남아 있는
 * 것은 **레이어 분리의 기준선**이기 때문이다 — 벤치마크의 대조군이고,
 * 컬링·레이어 정합성 검사가 "합쳐서 그리면 무엇이 나와야 하는가"로 삼는 답이다.
 */
export function renderScene(
  ctx: CanvasRenderingContext2D,
  state: EditorState,
  size: ViewSize,
  dpr: number,
): void {
  const { camera, scene, draft, editingId } = state
  const view = enterWorld(ctx, camera, size, dpr, true)

  drawGrid(ctx, camera, size.width, size.height)

  for (const id of scene.order) {
    // 편집 중인 텍스트는 textarea 오버레이가 대신 보여준다. 겹쳐 그리면 두 번 보인다
    if (id === editingId) continue
    const shape = scene.shapes[id]
    if (shape && isVisible(shape, view, camera.zoom)) drawShape(ctx, shape, camera.zoom)
  }

  // draft는 지금 그리는 중인 도형이라 늘 포인터 근처에 있다. 거를 이유가 없다
  if (draft && draft.id !== editingId) drawShape(ctx, draft, camera.zoom)

  drawOverlay(ctx, state)
}

/**
 * 정적 레이어 — 지금 움직이지 않는 도형 전부.
 *
 * **여기가 비싼 대신 자주 돌지 않는다.** 도형 수에 비례하는 컬링 순회가 남아
 * 있지만, 카메라·씬 구조·활성 집합이 바뀔 때만 실행된다. 드래그하는 동안에는
 * 한 번도 돌지 않는다.
 */
export function drawStaticLayer(
  ctx: CanvasRenderingContext2D,
  state: EditorState,
  size: ViewSize,
  dpr: number,
  active: ReadonlySet<string>,
): void {
  const { camera, scene, editingId } = state
  const view = enterWorld(ctx, camera, size, dpr, true)

  drawGrid(ctx, camera, size.width, size.height)

  for (const id of scene.order) {
    if (id === editingId) continue
    // 활성 레이어가 맡은 도형. 양쪽에 그리면 옮기는 동안 잔상이 남는다
    if (active.has(id)) continue
    const shape = scene.shapes[id]
    if (shape && isVisible(shape, view, camera.zoom)) drawShape(ctx, shape, camera.zoom)
  }
}

/**
 * 활성 레이어 — 지금 조작 중인 도형, 생성 중인 draft, 선택 UI.
 *
 * 매 프레임 돌지만 순회 대상이 `activeOrdered`뿐이라 도형 수와 무관하다.
 * 순서는 호출부가 z-order로 세워서 넘긴다 — 함께 끌려가는 도형들끼리의 앞뒤
 * 관계는 유지되어야 하고, 활성 집합 자체는 선택한 순서라 그대로 쓰면 뒤집힌다.
 *
 * **정적 레이어와의 z-order는 지켜지지 않는다.** 조작 중인 도형은 무엇 위에
 * 있든 맨 앞에 뜬다. 정확히 하려면 매 프레임 전체 순서를 다시 세워야 해서
 * 레이어를 나눈 이유가 사라지고, 어긋남은 포인터를 떼는 순간 사라진다.
 */
export function drawActiveLayer(
  ctx: CanvasRenderingContext2D,
  state: EditorState,
  size: ViewSize,
  dpr: number,
  activeOrdered: readonly string[],
): void {
  const { camera, scene, draft, editingId } = state
  const view = enterWorld(ctx, camera, size, dpr, false)

  for (const id of activeOrdered) {
    if (id === editingId) continue
    const shape = scene.shapes[id]
    if (shape && isVisible(shape, view, camera.zoom)) drawShape(ctx, shape, camera.zoom)
  }

  if (draft && draft.id !== editingId) drawShape(ctx, draft, camera.zoom)

  drawOverlay(ctx, state)
}
