import { RESIZE_HANDLES, type HandleId, type Point } from './types'

export type Rect = { x: number; y: number; width: number; height: number }

/**
 * 회전을 가진 축 정렬 상자.
 *
 * 핸들·리사이즈는 도형이 아니라 이 상자에 대해 정의된다. 하나만 선택했을 때는
 * 도형 자신이 상자이고(`Shape`가 구조적으로 `Box`다), 여럿을 선택했을 때는
 * 회전 없는 공통 바운딩 박스가 상자가 된다. 덕분에 단일 선택과 다중 선택이
 * 같은 코드를 탄다.
 */
export type Box = Rect & { rotation: number }

/** 드래그 방향이 반대여도(음수 폭/높이) 항상 양수 폭의 사각형으로 정규화 */
export function normalizeRect(a: Point, b: Point): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  }
}

export function getCenter(rect: Rect): Point {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
}

export function rotatePoint(p: Point, origin: Point, angle: number): Point {
  if (angle === 0) return p
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const dx = p.x - origin.x
  const dy = p.y - origin.y
  return { x: origin.x + dx * cos - dy * sin, y: origin.y + dx * sin + dy * cos }
}

/**
 * 월드 좌표의 점을 도형의 회전을 상쇄한 좌표계로 옮긴다.
 * 회전을 도입해도 히트 테스트를 축 정렬(AABB) 검사로 유지할 수 있는 이유가 이것이다.
 */
export function toLocal(p: Point, box: Box): Point {
  return rotatePoint(p, getCenter(box), -box.rotation)
}

/** 점과 선분 사이의 최단 거리. 펜 히트 테스트와 곡선 단순화가 함께 쓴다 */
export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return Math.hypot(p.x - a.x, p.y - a.y)
  // 선분 위로의 사영 비율을 0~1로 잘라 선분 밖으로 나가지 않게 한다
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

/** 회전을 반영한 네 모서리 (nw, ne, se, sw 순) */
export function getCorners(box: Box): Point[] {
  const c = getCenter(box)
  const { x, y, width: w, height: h, rotation } = box
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ].map((p) => rotatePoint(p, c, rotation))
}

/** 회전까지 감싸는 축 정렬 바운딩 박스 */
export function getWorldBounds(box: Box): Rect {
  if (box.rotation === 0) {
    return { x: box.x, y: box.y, width: box.width, height: box.height }
  }
  return boundsOfPoints(getCorners(box))
}

export function boundsOfPoints(points: Point[]): Rect {
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
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

/** 여러 도형을 함께 감싸는 박스 (회전 반영) */
export function getSelectionBounds(shapes: Box[]): Rect | null {
  if (shapes.length === 0) return null
  const boxes = shapes.map(getWorldBounds)
  return boundsOfPoints(
    boxes.flatMap((b) => [
      { x: b.x, y: b.y },
      { x: b.x + b.width, y: b.y + b.height },
    ]),
  )
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
  )
}

/**
 * 핸들의 월드 좌표.
 * 회전 핸들은 도형에서 화면상 일정 거리만큼 떨어져야 하므로
 * 월드 거리로 환산하려면 zoom이 필요하다.
 */
export function getHandlePoints(
  box: Box,
  rotateGapScreenPx: number,
  zoom: number,
): Record<HandleId, Point> {
  const { x, y, width: w, height: h, rotation } = box
  const c = getCenter(box)
  const local: Record<HandleId, Point> = {
    nw: { x, y },
    n: { x: x + w / 2, y },
    ne: { x: x + w, y },
    e: { x: x + w, y: y + h / 2 },
    se: { x: x + w, y: y + h },
    s: { x: x + w / 2, y: y + h },
    sw: { x, y: y + h },
    w: { x, y: y + h / 2 },
    rotate: { x: x + w / 2, y: y - rotateGapScreenPx / zoom },
  }
  const out = {} as Record<HandleId, Point>
  for (const key of Object.keys(local) as HandleId[]) {
    out[key] = rotatePoint(local[key], c, rotation)
  }
  return out
}

/**
 * 포인터 위치에 걸리는 핸들을 찾는다. 히트 반경은 화면 기준으로 일정하게 유지.
 *
 * `withRotate`가 꺼져 있으면 회전 핸들을 아예 검사하지 않는다. 다중 선택의
 * 공통 박스는 아직 통째로 회전할 수 없어서, 그리지 않은 핸들이 집히면 안 된다.
 */
export function pickHandle(
  box: Box,
  p: Point,
  hitRadiusScreenPx: number,
  zoom: number,
  withRotate: boolean,
): HandleId | null {
  const points = getHandlePoints(box, ROTATE_HANDLE_GAP, zoom)
  const radius = hitRadiusScreenPx / zoom
  // 회전 핸들을 먼저 검사한다. 코너 핸들과 겹칠 때 회전이 우선이어야 조작이 자연스럽다
  const ids: HandleId[] = withRotate ? ['rotate', ...RESIZE_HANDLES] : RESIZE_HANDLES
  for (const id of ids) {
    const h = points[id]
    if (Math.abs(p.x - h.x) <= radius && Math.abs(p.y - h.y) <= radius) return id
  }
  return null
}

export const ROTATE_HANDLE_GAP = 24
