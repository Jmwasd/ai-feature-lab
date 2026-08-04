import { LINE_HEIGHT_RATIO, type PathPoint, type Point, type Scene, type Shape } from '../core/types'
import { measureTextShape } from '../render/textMetrics'
import { normalizeLine } from '../shapes/line'
import { normalizePoints } from '../shapes/path'

/**
 * 벤치마크용 씬 생성기.
 *
 * 난수는 시드를 받아 재현 가능하게 만든다. 최적화 전후를 비교하려면 **같은 씬**을
 * 측정해야 하는데, `Math.random()`을 쓰면 실행마다 도형 구성이 달라져 개선인지
 * 운인지 구분할 수 없다.
 */

/** mulberry32 — 짧고 분포가 고른 시드 PRNG */
function makeRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type SeedOptions = {
  count: number
  /** 도형이 흩뿌려질 정사각 월드 영역의 한 변 */
  area: number
  seed: number
}

export const DEFAULT_SEED: SeedOptions = { count: 10000, area: 6000, seed: 1 }

/**
 * 도형 구성비. 실제 사용을 흉내 내되 **펜 획의 비중을 낮추지 않는다** —
 * 획 하나가 수십 점이라 히트 테스트 비용이 도형 수 × 점 수로 붙는,
 * 이 프로젝트에서 가장 비싼 도형이기 때문이다.
 */
const MIX: { type: Shape['type']; weight: number }[] = [
  { type: 'rect', weight: 0.3 },
  { type: 'ellipse', weight: 0.2 },
  { type: 'path', weight: 0.25 },
  { type: 'line', weight: 0.15 },
  { type: 'text', weight: 0.1 },
]

const PALETTE = ['#3b4252', '#4c566a', '#5e81ac', '#a3be8c', '#bf616a', '#d08770']
const WORDS = ['캔버스', '벤치마크', 'quadtree', '컬링', '프레임', 'shape', '월드', '좌표계']

function pickType(r: number): Shape['type'] {
  let acc = 0
  for (const entry of MIX) {
    acc += entry.weight
    if (r < acc) return entry.type
  }
  return 'rect'
}

/** 손으로 그은 획을 흉내 낸 점열. 방향을 조금씩 틀며 나아간다 */
function wanderingStroke(start: Point, steps: number, rand: () => number): PathPoint[] {
  const points: PathPoint[] = [{ ...start }]
  let angle = rand() * Math.PI * 2
  let { x, y } = start
  for (let i = 0; i < steps; i++) {
    angle += (rand() - 0.5) * 0.9
    const step = 3 + rand() * 7
    x += Math.cos(angle) * step
    y += Math.sin(angle) * step
    // 절반은 필압을 실어 가변 폭 렌더 경로(조각별 stroke)를 타게 한다
    points.push(rand() < 0.5 ? { x, y, pressure: 0.2 + rand() * 0.8 } : { x, y })
  }
  return points
}

export function seedScene(opts: Partial<SeedOptions> = {}): Scene {
  const { count, area, seed } = { ...DEFAULT_SEED, ...opts }
  const rand = makeRandom(seed)

  const shapes: Record<string, Shape> = {}
  const order: string[] = []

  for (let i = 0; i < count; i++) {
    const id = `bench-${i}`
    const x = rand() * area
    const y = rand() * area
    // 회전은 일부에만. 전부 회전시키면 getWorldBounds가 늘 4모서리를 도는
    // 최악 경로만 재게 되어 실제보다 비관적인 숫자가 나온다
    const rotation = rand() < 0.25 ? rand() * Math.PI * 2 : 0
    const stroke = PALETTE[Math.floor(rand() * PALETTE.length)]
    const fill = PALETTE[Math.floor(rand() * PALETTE.length)]
    const type = pickType(rand())

    let shape: Shape
    if (type === 'path') {
      const stepCount = 10 + Math.floor(rand() * 50)
      shape = {
        id,
        type: 'path',
        ...normalizePoints(wanderingStroke({ x, y }, stepCount, rand)),
        rotation,
        fill: 'transparent',
        stroke,
        strokeWidth: 1 + rand() * 4,
      }
    } else if (type === 'line') {
      const end = { x: x + (rand() - 0.5) * 200, y: y + (rand() - 0.5) * 200 }
      shape = {
        id,
        type: 'line',
        ...normalizeLine({ x, y }, end),
        rotation,
        fill: 'transparent',
        stroke,
        strokeWidth: 1 + rand() * 4,
        arrow: rand() < 0.5 ? 'end' : 'none',
      }
    } else if (type === 'text') {
      const words = 1 + Math.floor(rand() * 3)
      const text = Array.from({ length: words }, () => WORDS[Math.floor(rand() * WORDS.length)]).join(' ')
      const fontSize = 12 + rand() * 20
      const base = {
        id,
        type: 'text' as const,
        x,
        y,
        width: 0,
        height: fontSize * LINE_HEIGHT_RATIO,
        rotation,
        fill: 'transparent',
        stroke,
        text,
        fontSize,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        align: 'left' as const,
        wrapWidth: null,
      }
      // 박스를 실제로 재둬야 컬링 판정이 진짜 크기로 이뤄진다
      shape = { ...base, ...measureTextShape(base) }
    } else {
      const w = 20 + rand() * 140
      const h = 20 + rand() * 140
      const box = { id, x, y, width: w, height: h, rotation, fill, stroke }
      shape = type === 'rect' ? { ...box, type: 'rect' } : { ...box, type: 'ellipse' }
    }

    shapes[id] = shape
    order.push(id)
  }

  return { shapes, order }
}
