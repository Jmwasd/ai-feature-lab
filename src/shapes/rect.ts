import type { Point, RectShape, StyleField } from '../core/types'

export const styleFields: StyleField[] = ['fill', 'stroke']

/** 테두리는 경계선 위에 걸쳐 그려지므로 절반이 박스 밖으로 나간다 */
export function renderPad(_shape: RectShape, zoom: number): number {
  return 0.75 / zoom
}

/** 회전이 상쇄된 로컬 좌표를 받는다. 회전 처리는 호출부가 이미 끝냈다 */
export function hitTest(shape: RectShape, local: Point, _zoom: number): boolean {
  return (
    local.x >= shape.x &&
    local.x <= shape.x + shape.width &&
    local.y >= shape.y &&
    local.y <= shape.y + shape.height
  )
}

/** 회전은 렌더러가 변환 행렬로 걸어주므로 여기서는 축 정렬 상태로 그린다 */
export function draw(ctx: CanvasRenderingContext2D, shape: RectShape, zoom: number): void {
  ctx.fillStyle = shape.fill
  ctx.strokeStyle = shape.stroke
  // 선 굵기는 줌에 반비례해야 화면상 두께가 일정하게 유지된다
  ctx.lineWidth = 1.5 / zoom
  // 모서리 모양을 명시하지 않으면 직전에 그려진 도형이 남긴 값을 물려받는다.
  // 펜(`lineJoin = 'round'`) 바로 뒤에 그려지면 모서리가 둥글어진다
  ctx.lineJoin = 'miter'
  ctx.beginPath()
  ctx.rect(shape.x, shape.y, shape.width, shape.height)
  ctx.fill()
  ctx.stroke()
}
