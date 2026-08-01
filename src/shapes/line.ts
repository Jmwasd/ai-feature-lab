import { distanceToSegment } from '../core/geometry'
import { HIT_PAD_PX, type LineShape, type Point, type StyleField } from '../core/types'

export const styleFields: StyleField[] = ['stroke', 'strokeWidth', 'arrow']

/** 화살촉 크기. 굵기에 비례하되 화면상 이 값보다 작아지지 않는다 */
const MIN_HEAD_PX = 8
const HEAD_PER_WIDTH = 4
/** 화살촉이 벌어지는 각도 */
const HEAD_SPREAD = Math.PI / 7

/** 정규화된 끝점을 월드 좌표로 되돌린다 */
export function endpoints(shape: LineShape): [Point, Point] {
  const toWorld = (p: Point): Point => ({
    x: shape.x + p.x * shape.width,
    y: shape.y + p.y * shape.height,
  })
  return [toWorld(shape.start), toWorld(shape.end)]
}

/**
 * 두 월드 점을 바운딩 박스 + 정규화 끝점으로 압축한다.
 *
 * 수평선·수직선은 한 축의 폭이 0이 되므로 펜과 같은 방식으로 0 나눗셈을 막는다.
 * 이때 두 끝점의 해당 축 좌표가 모두 0이 되어 선은 박스 위쪽 변에 붙는다.
 */
export function normalizeLine(
  a: Point,
  b: Point,
): Pick<LineShape, 'x' | 'y' | 'width' | 'height' | 'start' | 'end'> {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  const width = Math.abs(a.x - b.x)
  const height = Math.abs(a.y - b.y)
  const dx = width || 1
  const dy = height || 1
  const toLocal = (p: Point): Point => ({ x: (p.x - x) / dx, y: (p.y - y) / dy })
  return { x, y, width, height, start: toLocal(a), end: toLocal(b) }
}

/**
 * 선은 둥근 캡만큼, 화살표는 화살촉만큼 박스 밖으로 나간다.
 * 화살촉은 끝점에서 뒤로 벌어지므로 최대로 삐져나오는 거리가 촉 크기다.
 */
export function renderPad(shape: LineShape, zoom: number): number {
  const cap = shape.strokeWidth / 2
  if (shape.arrow === 'none') return cap
  return cap + Math.max(shape.strokeWidth * HEAD_PER_WIDTH, MIN_HEAD_PX / zoom)
}

/** 회전이 상쇄된 로컬 좌표를 받는다 */
export function hitTest(shape: LineShape, local: Point, zoom: number): boolean {
  // 굵은 선은 그 굵기만큼, 얇은 선은 화면 기준 여유만큼 집을 수 있어야 한다
  const pad = Math.max(shape.strokeWidth / 2, HIT_PAD_PX / zoom)
  const [a, b] = endpoints(shape)
  return distanceToSegment(local, a, b) <= pad
}

/** 끝점 `tip`에서 `from` 쪽으로 벌어지는 삼각형 */
function drawHead(
  ctx: CanvasRenderingContext2D,
  tip: Point,
  from: Point,
  size: number,
): void {
  const angle = Math.atan2(tip.y - from.y, tip.x - from.x)
  ctx.beginPath()
  ctx.moveTo(tip.x, tip.y)
  for (const sign of [-1, 1]) {
    const a = angle + Math.PI + sign * HEAD_SPREAD
    ctx.lineTo(tip.x + Math.cos(a) * size, tip.y + Math.sin(a) * size)
  }
  ctx.closePath()
  ctx.fill()
}

export function draw(ctx: CanvasRenderingContext2D, shape: LineShape, zoom: number): void {
  const [a, b] = endpoints(shape)

  ctx.strokeStyle = shape.stroke
  ctx.fillStyle = shape.stroke
  ctx.lineWidth = shape.strokeWidth
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(b.x, b.y)
  ctx.stroke()

  if (shape.arrow === 'none') return
  // 길이가 0이면 방향을 정할 수 없다. 화살촉만 생략하고 점은 그대로 남긴다
  if (a.x === b.x && a.y === b.y) return

  const size = Math.max(shape.strokeWidth * HEAD_PER_WIDTH, MIN_HEAD_PX / zoom)
  drawHead(ctx, b, a, size)
  if (shape.arrow === 'both') drawHead(ctx, a, b, size)
}
