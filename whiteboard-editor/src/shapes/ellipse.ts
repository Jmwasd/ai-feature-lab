import type { EllipseShape, Point, StyleField } from '../core/types'

export const styleFields: StyleField[] = ['fill', 'stroke']

/** 테두리는 경계선 위에 걸쳐 그려지므로 절반이 박스 밖으로 나간다 */
export function renderPad(_shape: EllipseShape, zoom: number): number {
  return 0.75 / zoom
}

/** 회전이 상쇄된 로컬 좌표를 받는다 */
export function hitTest(shape: EllipseShape, local: Point, _zoom: number): boolean {
  const rx = shape.width / 2
  const ry = shape.height / 2
  if (rx === 0 || ry === 0) return false
  // 타원을 단위원으로 정규화해서 판정한다
  const dx = (local.x - (shape.x + rx)) / rx
  const dy = (local.y - (shape.y + ry)) / ry
  return dx * dx + dy * dy <= 1
}

export function draw(ctx: CanvasRenderingContext2D, shape: EllipseShape, zoom: number): void {
  const rx = shape.width / 2
  const ry = shape.height / 2
  ctx.fillStyle = shape.fill
  ctx.strokeStyle = shape.stroke
  ctx.lineWidth = 1.5 / zoom
  ctx.beginPath()
  ctx.ellipse(shape.x + rx, shape.y + ry, Math.abs(rx), Math.abs(ry), 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
}
