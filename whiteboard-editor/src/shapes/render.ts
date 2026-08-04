import type { Shape, ShapeType } from '../core/types'
import * as ellipse from './ellipse'
import * as line from './line'
import * as path from './path'
import * as rect from './rect'
import * as text from './text'

/**
 * 도형 종류별 그리기 매핑. Canvas에 의존하는 유일한 레지스트리다.
 * 순수 로직(`registry.ts`)과 분리해 두어야 서버가 이 파일을 끌어오지 않는다.
 */
type Drawers = {
  [K in ShapeType]: (
    ctx: CanvasRenderingContext2D,
    shape: Extract<Shape, { type: K }>,
    zoom: number,
  ) => void
}

const DRAW: Drawers = {
  rect: rect.draw,
  ellipse: ellipse.draw,
  path: path.draw,
  line: line.draw,
  text: text.draw,
}

/** 회전은 호출부가 변환 행렬로 이미 걸어둔 상태로 들어온다 */
export function drawShapeBody(
  ctx: CanvasRenderingContext2D,
  shape: Shape,
  zoom: number,
): void {
  const draw = DRAW[shape.type] as (
    c: CanvasRenderingContext2D,
    s: Shape,
    z: number,
  ) => void
  draw(ctx, shape, zoom)
}
