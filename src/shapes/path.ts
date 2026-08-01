import { distanceToSegment } from '../core/geometry'
import { HIT_PAD_PX, type PathPoint, type PathShape, type Point, type StyleField } from '../core/types'

export const styleFields: StyleField[] = ['stroke', 'strokeWidth']

/**
 * 정규화된 점들을 월드 좌표로 되돌린다.
 *
 * 정규화 좌표 그대로 거리를 계산하면 바운딩 박스의 종횡비만큼
 * 거리가 왜곡되므로, 판정과 렌더 모두 월드로 펼친 뒤에 한다.
 */
export function toWorldPoints(shape: PathShape): PathPoint[] {
  return shape.points.map((p) => ({
    ...p,
    x: shape.x + p.x * shape.width,
    y: shape.y + p.y * shape.height,
  }))
}

/** 월드 좌표 점들을 바운딩 박스 + 정규화 좌표로 압축한다 */
export function normalizePoints(points: PathPoint[]): {
  x: number
  y: number
  width: number
  height: number
  points: PathPoint[]
} {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of points) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  const width = maxX - minX
  const height = maxY - minY
  // 완전한 수평선·수직선은 한 축의 폭이 0이 된다. 0으로 나누지 않도록 막는다
  const dx = width || 1
  const dy = height || 1
  return {
    x: minX,
    y: minY,
    width,
    height,
    // 필압 같은 부가 정보는 그대로 실어 나른다
    points: points.map((p) => ({ ...p, x: (p.x - minX) / dx, y: (p.y - minY) / dy })),
  }
}

/**
 * 획은 점열의 바운딩 박스보다 굵기의 절반만큼 넓게 그려진다.
 * 필압이 실리면 굵기가 1.5배까지 오르므로 그 최댓값을 기준으로 잡는다.
 */
export function renderPad(shape: PathShape, _zoom: number): number {
  return shape.strokeWidth * 0.75
}

/** 회전이 상쇄된 로컬 좌표를 받는다 */
export function hitTest(shape: PathShape, local: Point, zoom: number): boolean {
  // 월드 단위로 고정하면 축소했을 때 획이 화면상 실오라기가 되어 집을 수 없다.
  // 화면 기준 여유를 월드로 환산해 어느 배율에서든 같은 감각을 유지한다
  const pad = Math.max(shape.strokeWidth / 2, HIT_PAD_PX / zoom)
  // 선분을 전부 훑기 전에 바운딩 박스로 걸러낸다
  if (
    local.x < shape.x - pad ||
    local.x > shape.x + shape.width + pad ||
    local.y < shape.y - pad ||
    local.y > shape.y + shape.height + pad
  ) {
    return false
  }

  const points = toWorldPoints(shape)
  if (points.length === 0) return false
  if (points.length === 1) {
    return Math.hypot(local.x - points[0].x, local.y - points[0].y) <= pad
  }
  for (let i = 0; i < points.length - 1; i++) {
    if (distanceToSegment(local, points[i], points[i + 1]) <= pad) return true
  }
  return false
}

/**
 * 필압을 굵기로 환산한다.
 *
 * 마우스로 누르고 있을 때의 값이 0.5라, 0.5에서 원래 굵기가 되도록 맞춘다.
 * 결과 범위는 기본 굵기의 0.5~1.5배다.
 */
function widthAt(base: number, pressure: number | undefined): number {
  return pressure === undefined ? base : base * (0.5 + pressure)
}

const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

/**
 * 점 하나짜리 획. 선으로 그릴 수 없으므로 둥근 캡으로 점을 찍는다.
 */
function drawDot(ctx: CanvasRenderingContext2D, p: PathPoint, base: number): void {
  ctx.lineWidth = widthAt(base, p.pressure)
  ctx.beginPath()
  ctx.moveTo(p.x, p.y)
  ctx.lineTo(p.x, p.y)
  ctx.stroke()
}

/**
 * 굵기가 일정한 획. 경로 하나로 한 번에 긋는다.
 *
 * 각 점을 제어점으로 두고 이웃한 두 점의 중점을 잇는다.
 * 꺾인 선분을 그대로 잇는 것보다 손그림처럼 부드럽게 나온다.
 */
function drawUniform(ctx: CanvasRenderingContext2D, points: PathPoint[], base: number): void {
  ctx.lineWidth = base
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)

  if (points.length === 2) {
    ctx.lineTo(points[1].x, points[1].y)
  } else {
    for (let i = 1; i < points.length - 1; i++) {
      const mid = midpoint(points[i], points[i + 1])
      ctx.quadraticCurveTo(points[i].x, points[i].y, mid.x, mid.y)
    }
    const last = points[points.length - 1]
    ctx.lineTo(last.x, last.y)
  }
  ctx.stroke()
}

/**
 * 필압이 실린 획.
 *
 * 굵기는 경로 하나에 하나뿐이라 가변 폭을 한 번에 그릴 수 없다.
 * 그래서 점마다 짧은 곡선 조각으로 끊어 각자의 굵기로 긋는다.
 * 조각 사이 이음매는 둥근 캡이 메워준다.
 */
function drawPressured(ctx: CanvasRenderingContext2D, points: PathPoint[], base: number): void {
  if (points.length === 2) {
    ctx.lineWidth = widthAt(base, points[1].pressure)
    ctx.beginPath()
    ctx.moveTo(points[0].x, points[0].y)
    ctx.lineTo(points[1].x, points[1].y)
    ctx.stroke()
    return
  }

  for (let i = 1; i < points.length - 1; i++) {
    const from = i === 1 ? points[0] : midpoint(points[i - 1], points[i])
    const to = midpoint(points[i], points[i + 1])
    ctx.lineWidth = widthAt(base, points[i].pressure)
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.quadraticCurveTo(points[i].x, points[i].y, to.x, to.y)
    ctx.stroke()
  }

  const last = points[points.length - 1]
  const prev = points[points.length - 2]
  ctx.lineWidth = widthAt(base, last.pressure)
  ctx.beginPath()
  ctx.moveTo(midpoint(prev, last).x, midpoint(prev, last).y)
  ctx.lineTo(last.x, last.y)
  ctx.stroke()
}

export function draw(ctx: CanvasRenderingContext2D, shape: PathShape, _zoom: number): void {
  const points = toWorldPoints(shape)
  if (points.length === 0) return

  ctx.strokeStyle = shape.stroke
  // 펜은 실제로 그어진 획이므로 굵기가 월드 단위다. 확대하면 같이 굵어진다
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  if (points.length === 1) {
    drawDot(ctx, points[0], shape.strokeWidth)
    return
  }
  // 필압이 없는 획은 경로 하나로 긋는 편이 훨씬 싸다
  if (points.some((p) => p.pressure !== undefined)) {
    drawPressured(ctx, points, shape.strokeWidth)
  } else {
    drawUniform(ctx, points, shape.strokeWidth)
  }
}
