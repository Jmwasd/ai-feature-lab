import { LINE_HEIGHT_RATIO, type TextShape } from '../core/types'
import { fontString, layoutLines, type MeasureText } from '../shapes/text'

/**
 * 텍스트 크기 측정.
 *
 * 다른 도형은 사용자가 크기를 정하지만 텍스트는 폰트가 정한다.
 * 그래서 이 프로젝트에서 유일하게 "브라우저에 물어봐야 크기를 알 수 있는" 도형이다.
 *
 * 줄바꿈 규칙 자체는 `shapes/text.ts`에 순수 함수로 두고 여기서는 측정만 제공한다.
 * 서버가 텍스트 박스 크기를 알아야 하는 상황(M5 협업에서 충돌 검증 등)이 오면
 * 폰트 메트릭 테이블로 만든 측정 함수를 같은 자리에 끼워 넣으면 된다.
 */
let measureContext: CanvasRenderingContext2D | null = null

function getMeasureContext(): CanvasRenderingContext2D {
  if (!measureContext) {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2d 컨텍스트를 만들 수 없습니다')
    measureContext = ctx
  }
  return measureContext
}

/** 하나의 컨텍스트를 돌려쓰므로 잴 때마다 폰트를 다시 지정한다 */
export function measurerFor(fontSize: number, fontFamily: string): MeasureText {
  const ctx = getMeasureContext()
  const font = fontString(fontSize, fontFamily)
  return (text) => {
    ctx.font = font
    return ctx.measureText(text).width
  }
}

/**
 * 도형이 차지할 박스 크기.
 *
 * 고정 폭(`wrapWidth`)이 있으면 폭은 그 값 그대로이고 줄 수만 늘어난다.
 * 없으면 가장 긴 줄이 폭을 정한다.
 */
export function measureTextShape(shape: TextShape): { width: number; height: number } {
  const measure = measurerFor(shape.fontSize, shape.fontFamily)
  const lines = layoutLines(shape.text, shape.wrapWidth, measure)

  let width = shape.wrapWidth ?? 0
  if (shape.wrapWidth === null) {
    for (const line of lines) width = Math.max(width, measure(line))
  }
  return { width, height: lines.length * shape.fontSize * LINE_HEIGHT_RATIO }
}
