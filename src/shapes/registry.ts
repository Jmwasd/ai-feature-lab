import type {
  HandleId,
  Point,
  Shape,
  ShapeType,
  StyleField,
  StyleValue,
  TextShape,
} from '../core/types'
import * as ellipse from './ellipse'
import * as line from './line'
import * as path from './path'
import * as rect from './rect'
import * as text from './text'

/**
 * 도형 종류별 히트 테스트 매핑.
 *
 * 그리기(draw)는 여기가 아니라 `render.ts`에 따로 둔다.
 * 이 파일은 Canvas에 의존하지 않아야 서버에서도 같은 판정 로직을
 * 그대로 가져다 쓸 수 있다.
 *
 * zoom을 받는 이유는 선처럼 얇은 도형 때문이다. 여유 폭을 월드 단위로
 * 고정하면 축소했을 때 화면상 실오라기가 되어 집을 수 없다.
 */
type HitTesters = {
  [K in ShapeType]: (shape: Extract<Shape, { type: K }>, local: Point, zoom: number) => boolean
}

const HIT: HitTesters = {
  rect: rect.hitTest,
  ellipse: ellipse.hitTest,
  path: path.hitTest,
  line: line.hitTest,
  text: text.hitTest,
}

/** 회전이 상쇄된 로컬 좌표를 받는다 */
export function hitTestLocal(shape: Shape, local: Point, zoom: number): boolean {
  // 유니온 값과 유니온 함수는 TypeScript가 짝지어 주지 못한다.
  // 등록 시점에 HitTesters로 검증되므로 호출부에서만 한 번 넓혀 쓴다
  const test = HIT[shape.type] as (s: Shape, p: Point, z: number) => boolean
  return test(shape, local, zoom)
}

/**
 * 그리기가 바운딩 박스 밖으로 삐져나오는 거리.
 *
 * 뷰포트 컬링이 이 값을 쓴다. 박스만 보고 자르면 화면 가장자리에서 굵은 획이나
 * 화살촉이 잘려 보이다가 튀어 들어온다. **얼마나 삐져나오는지는 도형만 안다** —
 * 화살촉 크기는 `line.ts`의 상수이고, 필압 획의 최대 굵기는 `path.ts`의 규칙이다.
 *
 * 판정이 아니라 그리기에 관한 값이지만 순수 계산이라 여기에 둔다.
 * 서버가 타일을 렌더할 때도 같은 여유가 필요하다.
 */
type PadCalculators = {
  [K in ShapeType]: (shape: Extract<Shape, { type: K }>, zoom: number) => number
}

const RENDER_PAD: PadCalculators = {
  rect: rect.renderPad,
  ellipse: ellipse.renderPad,
  path: path.renderPad,
  line: line.renderPad,
  text: text.renderPad,
}

export function renderPadOf(shape: Shape, zoom: number): number {
  const pad = RENDER_PAD[shape.type] as (s: Shape, z: number) => number
  return pad(shape, zoom)
}

/**
 * 도형별로 의미 있는 스타일 목록.
 *
 * 속성 패널이 무엇을 보여줄지 여기서 정해진다. 도형을 추가할 때
 * 패널 코드를 고치지 않아도 되도록 각 도형 모듈이 직접 선언한다.
 */
const STYLE_FIELDS: Record<ShapeType, StyleField[]> = {
  rect: rect.styleFields,
  ellipse: ellipse.styleFields,
  path: path.styleFields,
  line: line.styleFields,
  text: text.styleFields,
}

export function styleFieldsOf(type: ShapeType): StyleField[] {
  return STYLE_FIELDS[type]
}

export function supportsStyle(shape: Shape, field: StyleField): boolean {
  return STYLE_FIELDS[shape.type].includes(field)
}

/**
 * 스타일 한 항목을 바꾼 새 도형을 돌려준다.
 *
 * 지원하지 않는 속성은 조용히 무시한다. 여러 종류를 함께 선택한 상태에서
 * 색을 바꾸는 동작이 자연스럽게 "가능한 것만 적용"이 되어야 하기 때문이다.
 *
 * 텍스트의 `fontSize`처럼 박스 크기까지 바뀌는 속성은 여기서 처리하지 않는다.
 * 크기를 다시 재려면 브라우저가 필요하고, 이 파일은 순수해야 한다.
 */
export function applyStyle(shape: Shape, field: StyleField, value: StyleValue): Shape {
  if (!supportsStyle(shape, field)) return shape
  // 필드와 값의 짝은 호출부(패널 컨트롤)가 보장한다.
  // 유니온 전체에 대해 타입으로 표현하려면 필드마다 분기를 늘어놓아야 한다
  return { ...shape, [field]: value } as Shape
}

export type ResizeContext = {
  handle: HandleId
  /**
   * 텍스트 박스를 다시 재는 함수.
   * 브라우저 의존을 순수한 레지스트리 밖에 두기 위한 주입점이다.
   */
  measureTextShape: (shape: TextShape) => { width: number; height: number }
}

/**
 * 공통 리사이즈가 끝난 뒤 도형별로 손봐야 하는 것.
 *
 * 지금까지는 모든 도형이 바운딩 박스만 바꾸면 됐지만, 텍스트는 다르다.
 * 박스를 키우면 글자도 함께 커져야 하고, 좌우로만 끌면 줄바꿈 폭이 바뀌어야 한다.
 * 도형별 리사이즈가 갈라지는 첫 사례다.
 */
export function adjustAfterResize(next: Shape, original: Shape, ctx: ResizeContext): Shape {
  if (next.type !== 'text' || original.type !== 'text') return next

  // 좌우 핸들은 글자 크기가 아니라 줄바꿈 폭을 바꾼다.
  // 폭만 끌었는데 글꼴까지 커지면 고정 폭으로 문단을 만들 수 없다
  if (ctx.handle === 'e' || ctx.handle === 'w') {
    // 한 글자도 들어가지 않는 폭은 줄바꿈이 무한정 늘어나므로 막는다
    const wrapWidth = Math.max(next.width, next.fontSize)
    const box = ctx.measureTextShape({ ...next, wrapWidth })
    return { ...next, wrapWidth, width: box.width, height: box.height }
  }

  // 글꼴 크기는 축이 하나뿐이라 비균등 스케일을 표현할 수 없다.
  // 더 많이 끌린 축을 따라 균등 스케일해야 글자가 찌그러지지 않으면서도
  // 상하 핸들과 코너 핸들이 모두 반응한다
  const scaleX = original.width ? next.width / original.width : 1
  const scaleY = original.height ? next.height / original.height : 1
  const scale = Math.abs(scaleX - 1) > Math.abs(scaleY - 1) ? scaleX : scaleY
  if (scale <= 0) return next

  const fontSize = original.fontSize * scale
  // 고정 폭 문단은 글자와 같은 비율로 폭도 커져야 줄바꿈 위치가 유지된다
  const wrapWidth = original.wrapWidth === null ? null : original.wrapWidth * scale
  const box = ctx.measureTextShape({ ...next, fontSize, wrapWidth })

  return { ...next, fontSize, wrapWidth, width: box.width, height: box.height }
}
