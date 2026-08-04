import { getCenter, rotatePoint, toLocal, type Box, type Rect } from './geometry'
import type { HandleId, Point, Shape } from './types'

const MIN_SIZE = 1

export type ResizeOptions = {
  /** Shift — 종횡비 고정 (코너 핸들에서만 의미가 있다) */
  keepAspect: boolean
  /** Alt — 반대편 모서리 대신 중심을 고정 */
  fromCenter: boolean
}

const QUARTER_TURN = Math.PI / 2
/** 15° 스냅으로 만들어진 각도가 부동소수 오차를 안고 들어오므로 여유를 둔다 */
const ANGLE_EPSILON = 1e-6

/**
 * 각도가 90°의 몇 배인지(0~3). 배수가 아니면 null.
 *
 * 이 판정이 다중 리사이즈의 갈림길이다. 상자 축을 따라 x와 y를 서로 다른
 * 비율로 늘이면, 그 축에 대해 비스듬히 놓인 사각형은 **평행사변형이 되어야
 * 한다.** 그런데 `rotation` 각도 하나로는 평행사변형을 표현할 수 없다.
 * 90°의 배수일 때만 폭과 높이가 맞바뀔 뿐 사각형이 사각형으로 남는다.
 */
function quarterTurns(angle: number): number | null {
  const turns = angle / QUARTER_TURN
  const rounded = Math.round(turns)
  if (Math.abs(turns - rounded) > ANGLE_EPSILON) return null
  return ((rounded % 4) + 4) % 4
}

/**
 * 상자의 로컬 좌표계에서 네 변을 갱신해 새 상자를 만든다.
 * 여기서는 회전이 이미 상쇄되어 있으므로 축 정렬 사각형만 다룬다.
 */
function resizeLocalBox(
  box: Box,
  handle: HandleId,
  local: Point,
  opts: ResizeOptions,
  lockAspect: boolean,
): Rect {
  const center = getCenter(box)

  let left = box.x
  let right = box.x + box.width
  let top = box.y
  let bottom = box.y + box.height

  const touchesE = handle.includes('e')
  const touchesW = handle.includes('w')
  const touchesN = handle.includes('n')
  const touchesS = handle.includes('s')

  if (touchesE) right = local.x
  if (touchesW) left = local.x
  if (touchesN) top = local.y
  if (touchesS) bottom = local.y

  if (opts.fromCenter) {
    if (touchesE) left = 2 * center.x - right
    if (touchesW) right = 2 * center.x - left
    if (touchesN) bottom = 2 * center.y - top
    if (touchesS) top = 2 * center.y - bottom
  }

  if (lockAspect && box.width !== 0 && box.height !== 0) {
    const aspect = box.width / box.height
    let w = right - left
    let h = bottom - top

    // 어느 축이 포인터를 따라가는지는 핸들이 정한다. 변 핸들에서 "더 많이 끌린 축"을
    // 쓰면 안으로 끌 때 끌리지 않은 축이 기준이 되어 아무 반응도 하지 않는다
    if (touchesE || touchesW) {
      if (touchesN || touchesS) {
        // 코너 — 여기서만 더 많이 끌린 축을 기준으로 나머지를 맞춘다
        if (Math.abs(w) > Math.abs(h * aspect)) h = Math.sign(h || 1) * Math.abs(w / aspect)
        else w = Math.sign(w || 1) * Math.abs(h * aspect)
      } else {
        h = Math.sign(h || 1) * Math.abs(w / aspect)
      }
    } else {
      w = Math.sign(w || 1) * Math.abs(h * aspect)
    }

    if (opts.fromCenter) {
      left = center.x - w / 2
      right = center.x + w / 2
      top = center.y - h / 2
      bottom = center.y + h / 2
    } else {
      // 끌리지 않은 축에는 고정할 변이 없다. 중심선을 기준으로 양쪽으로 늘린다
      if (touchesW) left = right - w
      else if (touchesE) right = left + w
      else {
        const mid = (left + right) / 2
        left = mid - w / 2
        right = mid + w / 2
      }

      if (touchesN) top = bottom - h
      else if (touchesS) bottom = top + h
      else {
        const mid = (top + bottom) / 2
        top = mid - h / 2
        bottom = mid + h / 2
      }
    }
  }

  // 핸들을 반대편으로 넘겨 뒤집는 조작을 허용하되, 크기는 항상 양수로 정규화한다
  return {
    x: Math.min(left, right),
    y: Math.min(top, bottom),
    width: Math.max(MIN_SIZE, Math.abs(right - left)),
    height: Math.max(MIN_SIZE, Math.abs(bottom - top)),
  }
}

/** 퇴화한 축(폭이나 높이가 0인 선)은 비율을 정의할 수 없다. 새 상자 크기를 그대로 물려준다 */
function scaleExtent(extent: number, prevSize: number, nextSize: number): number {
  return prevSize === 0 ? nextSize : extent * (nextSize / prevSize)
}

/** 상자 안에서의 상대 위치(0~1). 퇴화한 축에서는 한가운데로 본다 */
function ratio(offset: number, size: number): number {
  return size === 0 ? 0.5 : offset / size
}

/**
 * 앵커(드래그하는 핸들의 반대편)를 고정한 채 상자 하나로 여러 도형을 함께 리사이즈한다.
 *
 * 회전한 상자가 핵심 난점이다. 월드 좌표에서 바로 계산하면 회전각이 붙는 순간
 * 어긋난다. 그래서 세 단계로 나눈다.
 *   1. 포인터를 상자의 로컬 좌표계(회전을 상쇄한 계)로 옮긴다
 *   2. 로컬에서는 축 정렬 사각형이므로 변을 그대로 갱신한다
 *   3. 바뀐 중심을 다시 월드로 되돌린다 — 이 보정이 없으면
 *      회전된 도형을 리사이즈할 때 도형이 옆으로 미끄러진다
 *
 * 도형은 상자 안에서의 상대 위치를 유지한 채 같은 비율로 커진다. 하나만 선택한
 * 경우는 도형이 곧 상자라 상대 위치가 늘 한가운데이고, 결과적으로 상자 계산이
 * 그대로 도형이 된다 — 단일 리사이즈가 다중 리사이즈의 특수 케이스인 셈이다.
 *
 * **회전이 섞이면 균등 스케일만 허용한다.** 상자 축에 대해 90°의 배수가 아닌
 * 도형이 하나라도 있으면 비균등 스케일의 결과가 평행사변형이라 `rotation`
 * 모델로 표현할 수 없다(`quarterTurns` 참고). 그때는 종횡비를 강제로 고정해
 * 두 축의 배율을 같게 만든다. 행렬 모델로 승격하기 전까지의 타협이다.
 */
export function resizeShapes(
  originals: Shape[],
  box: Box,
  handle: HandleId,
  pointerWorld: Point,
  opts: ResizeOptions,
): Shape[] {
  if (handle === 'rotate') return originals

  const turns = originals.map((shape) => quarterTurns(shape.rotation - box.rotation))
  const uniformOnly = turns.includes(null)
  const isCorner = handle.length === 2

  const center = getCenter(box)
  const next = resizeLocalBox(
    box,
    handle,
    toLocal(pointerWorld, box),
    opts,
    (opts.keepAspect && isCorner) || uniformOnly,
  )

  return originals.map((shape, i) => {
    // 상자 축에 대해 90°·270°로 놓인 도형은 폭과 높이가 맞바뀐 채 스케일된다.
    // 균등 스케일로 제한된 경우에는 두 축의 배율이 같아 이 구분이 결과를 바꾸지 않는다
    const swapped = (turns[i] ?? 0) % 2 === 1
    const width = swapped
      ? scaleExtent(shape.width, box.height, next.height)
      : scaleExtent(shape.width, box.width, next.width)
    const height = swapped
      ? scaleExtent(shape.height, box.width, next.width)
      : scaleExtent(shape.height, box.height, next.height)

    // 중심을 상자 로컬 좌표로 옮겨 상대 위치를 재고, 새 상자의 같은 자리로 보낸다.
    // 로컬 좌표계는 상자 중심을 축으로 -rotation 회전한 계이므로 되돌릴 때 +rotation
    const local = toLocal(getCenter(shape), box)
    const u = ratio(local.x - box.x, box.width)
    const v = ratio(local.y - box.y, box.height)
    const worldCenter = rotatePoint(
      { x: next.x + u * next.width, y: next.y + v * next.height },
      center,
      box.rotation,
    )

    return {
      ...shape,
      x: worldCenter.x - width / 2,
      y: worldCenter.y - height / 2,
      width,
      height,
    }
  })
}

export function angleFrom(center: Point, p: Point): number {
  return Math.atan2(p.y - center.y, p.x - center.x)
}

const SNAP_STEP = Math.PI / 12 // 15도

/** 드래그 시작 시점 대비 각도 변화량을 원본 회전에 더한다 */
export function rotateShape(
  original: Shape,
  startAngle: number,
  currentAngle: number,
  snap: boolean,
): Shape {
  let rotation = original.rotation + (currentAngle - startAngle)
  if (snap) rotation = Math.round(rotation / SNAP_STEP) * SNAP_STEP
  return { ...original, rotation }
}
