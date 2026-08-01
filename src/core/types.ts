export type Point = { x: number; y: number }

/**
 * 펜 획을 이루는 점.
 *
 * 필압은 스타일러스에서만 들어온다. 마우스는 누른 동안 항상 0.5라
 * 값이 있어도 의미가 없으므로 아예 넣지 않는다(undefined = 균일한 굵기).
 */
export type PathPoint = Point & { pressure?: number }

export type ShapeType = 'rect' | 'ellipse' | 'path' | 'line' | 'text'

export type TextAlign = 'left' | 'center' | 'right'

/** 시작점만 있는 화살표는 선을 뒤집은 것과 같아서 따로 두지 않는다 */
export type ArrowStyle = 'none' | 'end' | 'both'

/**
 * 모든 도형이 공유하는 바운딩 박스 모델.
 *
 * 도형 종류가 늘어나도 이 필드들은 같은 의미를 유지한다.
 * 덕분에 리사이즈·회전·핸들 계산을 도형별로 다시 구현할 필요가 없다.
 */
type ShapeBase = {
  id: string
  /** 월드 좌표 기준, 회전하지 않은 상태의 좌상단 */
  x: number
  y: number
  width: number
  height: number
  /** 도형 중심을 기준으로 한 회전각(라디안) */
  rotation: number
  fill: string
  stroke: string
}

export type RectShape = ShapeBase & { type: 'rect' }

export type EllipseShape = ShapeBase & { type: 'ellipse' }

export type PathShape = ShapeBase & {
  type: 'path'
  /**
   * 바운딩 박스를 기준으로 0~1로 정규화한 좌표.
   *
   * 절대 좌표로 저장하면 리사이즈할 때마다 모든 점을 다시 계산해야 하고
   * x/y/width/height와 정보가 중복된다. 정규화해두면 바운딩 박스만 바꿔도
   * 점들이 따라오므로 기존 리사이즈·회전 로직을 그대로 쓸 수 있다.
   */
  points: PathPoint[]
  /** 월드 단위. 확대하면 선도 같이 굵어진다 */
  strokeWidth: number
}

/**
 * 선과 화살표.
 *
 * 선은 양 끝점이 실체이고 바운딩 박스는 파생물이라 박스 모델에 잘 맞지 않는다.
 * 그래도 펜과 같은 방법 — 끝점을 박스 기준 0~1로 정규화하기 — 으로 맞춰 둔다.
 * 리사이즈·회전 코드를 그대로 재사용할 수 있고, 대각선 방향(어느 모서리에서
 * 어느 모서리로 긋는지)은 정규화 좌표가 그대로 들고 있기 때문이다.
 */
export type LineShape = ShapeBase & {
  type: 'line'
  /** 바운딩 박스 기준 0~1 정규화 */
  start: Point
  end: Point
  /** 월드 단위 */
  strokeWidth: number
  arrow: ArrowStyle
}

export type TextShape = ShapeBase & {
  type: 'text'
  text: string
  /** 월드 단위. 확대하면 글자도 같이 커진다 */
  fontSize: number
  fontFamily: string
  align: TextAlign
  /**
   * null이면 글자 길이가 박스 폭을 정한다(입력하는 대로 늘어난다).
   * 값이 있으면 그 폭(월드 단위)에 맞춰 자동으로 줄을 바꾼다.
   * 좌우 핸들로 리사이즈하면 이 값이 생긴다.
   */
  wrapWidth: number | null
}

export type Shape = RectShape | EllipseShape | PathShape | LineShape | TextShape

/**
 * 속성 패널이 다루는 편집 가능한 스타일.
 *
 * 도형마다 의미 있는 것이 다르다 — 펜과 선은 `strokeWidth`, 텍스트는
 * `fontSize`·`fontFamily`·`align`. 어떤 도형이 무엇을 지원하는지는
 * 각 도형 모듈이 `styleFields`로 선언하고 레지스트리가 모은다.
 */
export type StyleField =
  | 'fill'
  | 'stroke'
  | 'strokeWidth'
  | 'fontSize'
  | 'fontFamily'
  | 'align'
  | 'arrow'

export type StyleValue = string | number

/** 줄 간격 배수. 측정과 렌더가 같은 값을 써야 박스와 글자가 어긋나지 않는다 */
export const LINE_HEIGHT_RATIO = 1.25

/**
 * 얇은 도형(선·펜)을 집을 때의 최소 여유 폭. **화면 기준 px**이라 줌으로 나눠 쓴다.
 *
 * 여기 있는 이유는 공간 인덱스 때문이다. 인덱스는 후보를 좁힐 때 이 여유만큼
 * 넓게 질의해야 하는데, 값이 도형 모듈 안에 숨어 있으면 인덱스가 도형보다 좁게
 * 질의해 **판정에는 걸리는데 후보에는 없는** 도형이 생긴다. 찾기 어려운 종류의
 * 버그라 한 곳에서만 정의한다.
 */
export const HIT_PAD_PX = 6

/**
 * 씬은 도형 맵과 z-order 배열로 분리해서 들고 있다.
 * 배열 하나로만 관리하면 id 조회가 O(n)이 되고,
 * 맵 하나로만 관리하면 그리기 순서를 표현할 수 없다.
 */
export type Scene = {
  shapes: Record<string, Shape>
  order: string[]
}

/**
 * x, y는 뷰포트 좌상단이 가리키는 월드 좌표.
 * zoom은 배율 (1 = 100%).
 */
export type Camera = { x: number; y: number; zoom: number }

export type ToolId = 'select' | 'rect' | 'ellipse' | 'pen' | 'line' | 'arrow' | 'text'

/** 8방향 리사이즈 핸들과 회전 핸들 */
export type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'rotate'

export const RESIZE_HANDLES: HandleId[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

export const createEmptyScene = (): Scene => ({ shapes: {}, order: [] })
