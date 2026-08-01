import {
  LINE_HEIGHT_RATIO,
  type Point,
  type StyleField,
  type TextAlign,
  type TextShape,
} from '../core/types'

export const styleFields: StyleField[] = ['stroke', 'fontSize', 'fontFamily', 'align']

/**
 * 글자 폭을 재는 함수.
 *
 * 줄바꿈 계산 자체는 순수하게 두고 측정만 주입받는다.
 * 브라우저에서는 `ctx.measureText`가 들어오지만, 서버가 같은 줄바꿈을
 * 재현해야 할 때(M5)는 폰트 메트릭 테이블로 만든 함수를 넣으면 된다.
 */
export type MeasureText = (text: string) => number

/** 측정과 렌더가 반드시 같은 문자열을 써야 박스와 글자가 어긋나지 않는다 */
export function fontString(fontSize: number, fontFamily: string): string {
  return `${fontSize}px ${fontFamily}`
}

export function splitLines(text: string): string[] {
  return text.split('\n')
}

/**
 * 한 줄을 주어진 폭에 맞춰 여러 줄로 쪼갠다.
 *
 * 단어 단위로 채우다가, 단어 하나가 통째로 폭을 넘으면 글자 단위로 끊는다.
 * 후자가 없으면 띄어쓰기 없이 이어지는 한국어·일본어 문장이 한 줄로 삐져나간다.
 */
function wrapLine(line: string, wrapWidth: number, measure: MeasureText): string[] {
  if (!line) return ['']

  const out: string[] = []
  let current = ''
  // 앞 공백을 단어에 붙여 둬야 단어 사이 간격이 보존된다
  const words = line.match(/\s*\S+|\s+/g) ?? []

  for (const word of words) {
    if (current && measure(current + word) > wrapWidth) {
      out.push(current)
      // 줄 첫머리로 밀려난 공백은 버린다. 남기면 왼쪽 여백처럼 보인다
      current = word.replace(/^\s+/, '')
    } else {
      current += word
    }

    // 여기까지 왔는데도 폭을 넘으면 단어 하나가 한 줄보다 길다는 뜻이다
    while (measure(current) > wrapWidth && current.length > 1) {
      let cut = 1
      while (cut < current.length && measure(current.slice(0, cut + 1)) <= wrapWidth) cut++
      out.push(current.slice(0, cut))
      current = current.slice(cut)
    }
  }

  out.push(current)
  return out
}

/** 실제로 그려질 줄들. `wrapWidth`가 null이면 개행 문자만으로 나뉜다 */
export function layoutLines(
  text: string,
  wrapWidth: number | null,
  measure: MeasureText,
): string[] {
  const lines = splitLines(text)
  if (wrapWidth === null || wrapWidth <= 0) return lines
  return lines.flatMap((line) => wrapLine(line, wrapWidth, measure))
}

/** 정렬에 따른 줄의 x 오프셋. 박스 폭 안에서 줄을 어디에 놓을지 정한다 */
export function alignOffset(align: TextAlign, boxWidth: number, lineWidth: number): number {
  if (align === 'center') return (boxWidth - lineWidth) / 2
  if (align === 'right') return boxWidth - lineWidth
  return 0
}

/**
 * 박스는 줄 높이로 계산되지만 글리프는 그보다 조금 더 위아래로 뻗는다
 * (윗수염·아랫수염). 폰트마다 다르므로 글꼴 크기에 비례한 여유로 잡는다.
 */
export function renderPad(shape: TextShape, _zoom: number): number {
  return shape.fontSize * 0.3
}

/**
 * 회전이 상쇄된 로컬 좌표를 받는다.
 * 글자 모양이 아니라 박스로 판정한다. 글리프 단위 판정은 비용이 크고
 * 편집기에서 빈 줄이나 여백을 집을 수 없게 되어 오히려 불편하다.
 */
export function hitTest(shape: TextShape, local: Point, _zoom: number): boolean {
  return (
    local.x >= shape.x &&
    local.x <= shape.x + shape.width &&
    local.y >= shape.y &&
    local.y <= shape.y + shape.height
  )
}

export function draw(ctx: CanvasRenderingContext2D, shape: TextShape, _zoom: number): void {
  if (!shape.text) return

  ctx.fillStyle = shape.stroke
  ctx.font = fontString(shape.fontSize, shape.fontFamily)
  // top 기준이어야 박스 좌상단과 첫 줄 위치를 그대로 맞출 수 있다
  ctx.textBaseline = 'top'

  const measure: MeasureText = (t) => ctx.measureText(t).width
  const lineHeight = shape.fontSize * LINE_HEIGHT_RATIO
  const lines = layoutLines(shape.text, shape.wrapWidth, measure)

  for (let i = 0; i < lines.length; i++) {
    const x = shape.x + alignOffset(shape.align, shape.width, measure(lines[i]))
    ctx.fillText(lines[i], x, shape.y + i * lineHeight)
  }
}
