import { getWorldBounds, rectsIntersect, type Rect } from '../core/geometry'
import { hitTest, pickInRect, pickTopmost } from '../core/picking'
import { clearSceneIndexCache } from '../core/spatial/sceneIndex'
import type { Camera, Point, Scene, Shape } from '../core/types'
import { createLayers } from '../render/layers'
import { isVisible, renderScene, viewportWorldRect } from '../render/renderer'
import { actions, getState, type EditorState } from '../store/editorStore'
import { renderPadOf } from '../shapes/registry'
import { DEFAULT_SEED, seedScene, type SeedOptions } from './seed'

/**
 * 벤치마크 하네스.
 *
 * 앱의 렌더 루프(dirty 플래그로 필요할 때만 그린다)를 타지 않고 `renderScene`을
 * 직접 호출한다. 실제 프레임 타임 대신 **한 프레임을 그리는 데 드는 JS 시간**을
 * 재기 위해서다. 최적화 대상이 정확히 그 JS 시간이고, 루프를 거치면 브라우저의
 * 스케줄링 흔들림이 신호를 덮는다.
 *
 * Canvas 2D 호출은 커맨드를 쌓고 즉시 반환하므로 여기 숫자에 GPU 래스터화는
 * 들어 있지 않다. "도형을 건너뛰면 줄어드는 비용"을 재는 데는 그래서 오히려 낫다.
 */

/** 창 크기와 무관하게 같은 숫자가 나오도록 고정한 측정용 뷰포트 */
const VIEWPORT = { width: 1440, height: 900 }
const DPR = 1

export type Stats = {
  n: number
  mean: number
  p50: number
  p95: number
  min: number
  max: number
}

function stats(samples: number[]): Stats {
  const sorted = [...samples].sort((a, b) => a - b)
  const sum = sorted.reduce((acc, v) => acc + v, 0)
  const at = (q: number): number => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))]
  return {
    n: sorted.length,
    mean: sum / sorted.length,
    p50: at(0.5),
    p95: at(0.95),
    min: sorted[0],
    max: sorted[sorted.length - 1],
  }
}

/** 워밍업으로 JIT를 데운 뒤 측정한다. 첫 몇 회는 늘 몇 배 느리다 */
function measure(iterations: number, warmup: number, fn: (i: number) => void): Stats {
  for (let i = 0; i < warmup; i++) fn(i)
  const samples: number[] = []
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now()
    fn(i)
    samples.push(performance.now() - t0)
  }
  return stats(samples)
}

/**
 * 한 번이 타이머 해상도보다 짧은 연산을 잴 때.
 *
 * `performance.now()`는 브라우저가 지문 채취를 막으려고 일부러 뭉툭하게 만들어
 * 둔다. 공간 인덱스를 붙인 뒤의 픽은 그 눈금보다 빨라서 한 번씩 재면 전부
 * `0.000ms`로 나온다. 여러 번 묶어 재고 나눠야 숫자가 보인다.
 */
function measureBatched(
  iterations: number,
  warmup: number,
  batch: number,
  fn: (i: number) => void,
): Stats {
  const runBatch = (i: number): void => {
    for (let k = 0; k < batch; k++) fn(i * batch + k)
  }
  const raw = measure(iterations, warmup, runBatch)
  return {
    n: raw.n * batch,
    mean: raw.mean / batch,
    p50: raw.p50 / batch,
    p95: raw.p95 / batch,
    min: raw.min / batch,
    max: raw.max / batch,
  }
}

/*
 * 대조군 — 공간 인덱스를 붙이기 전의 선형 스캔.
 *
 * 남겨두는 이유는 **같은 실행, 같은 씬에서 A/B를 재기 위해서**다. 옛 커밋으로
 * 돌아가 따로 측정하면 기계 상태와 브라우저 버전이 달라 비교가 흐려지고,
 * 도형 수를 바꿔가며 O(n)과 O(log n)이 갈리는 지점을 볼 수도 없다.
 */
function pickTopmostLinear(scene: Scene, p: Point, zoom: number): Shape | null {
  for (let i = scene.order.length - 1; i >= 0; i--) {
    const shape = scene.shapes[scene.order[i]]
    if (shape && hitTest(shape, p, zoom)) return shape
  }
  return null
}

function pickInRectLinear(scene: Scene, rect: Rect): string[] {
  const ids: string[] = []
  for (const id of scene.order) {
    const shape = scene.shapes[id]
    if (shape && rectsIntersect(getWorldBounds(shape), rect)) ids.push(id)
  }
  return ids
}

/**
 * 인덱스를 거친 결과가 전체를 훑은 결과와 같은지 확인한다.
 *
 * 벤치마크에 붙여 두는 이유는, 공간 인덱스의 실패 방식이 **느려지는 것이 아니라
 * 조용히 틀리는 것**이기 때문이다. 여유 폭을 조금 좁게 잡으면 얇은 선 하나가
 * 후보에서 빠지는데, 화면에는 아무 표시도 나지 않는다. 숫자를 잴 때마다
 * 같은 씬으로 정합성을 함께 확인한다.
 */
export type VerifyResult = { checks: number; mismatches: string[] }

/**
 * 컬링이 보여야 할 도형을 지우지 않았는지 확인한다.
 *
 * **버린 도형만 모아 다시 그려본다.** 화면에 한 점이라도 칠해지면 버리면 안 될
 * 것이 섞여 있었다는 뜻이고, 그 집합을 반씩 갈라 들어가면 범인이 나온다.
 * 도형 하나씩 그려보면 1만 번이지만 이분 탐색이면 몇십 번이다.
 *
 * 다시 그릴 때는 **세 배 넓은 화면**을 쓴다. 좁은 화면 그대로 그리면 방금 버린
 * 도형이 또 걸러져서 아무것도 안 그려지고, 검사는 언제나 통과한다 — 처음에
 * 그렇게 짰다가 일부러 컬링을 망가뜨려도 통과하는 걸 보고 알아챘다. **검사가
 * 실패를 잡는지 확인하지 않으면 검사가 있다는 착각만 남는다.**
 *
 * 넓은 화면끼리 비교하는 것도 중요하다. 좁은 화면과 넓은 화면을 맞대면 같은
 * 도형이라도 캔버스 크기에 따라 안티에일리어싱 커버리지가 달라져 0.9%가
 * 어긋난다(최대 30/255). 캔버스 크기를 맞추면 그 잡음이 사라져 임계값 없이
 * 정확히 비교할 수 있다.
 */
function verifyCulling(scene: Scene, area: number): VerifyResult {
  const w = 400
  const h = 300
  const mismatches: string[] = []
  let checks = 0

  const canvas = document.createElement('canvas')
  canvas.width = w * 3
  canvas.height = h * 3
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('2d 컨텍스트를 만들 수 없습니다')

  for (const zoom of [0.4, 1, 2.5]) {
    for (const step of [0, 1, 2]) {
      const camera: Camera = { x: area * 0.2 + step * 137.5, y: area * 0.3 + step * 91.25, zoom }
      const view = viewportWorldRect(camera, w, h)
      // 좁은 화면이 넓은 화면 한가운데 오도록 한 화면만큼 앞에서 시작한다.
      // 좁은 화면에 걸치는 도형은 넓은 화면 안쪽 깊숙이 들어와 걸러지지 않는다
      const wide: Camera = { x: camera.x - w / zoom, y: camera.y - h / zoom, zoom }
      checks++

      const paint = (ids: string[]): Uint8ClampedArray => {
        const subset: Scene = { shapes: {}, order: ids }
        for (const id of ids) subset.shapes[id] = scene.shapes[id]
        renderScene(ctx, renderState(subset, wide), { width: w * 3, height: h * 3 }, 1)
        // 좁은 화면에 해당하는 가운데 영역만 본다
        return ctx.getImageData(w, h, w, h).data
      }

      const blank = paint([])
      const paintsSomething = (ids: string[]): boolean => {
        if (ids.length === 0) return false
        const px = paint(ids)
        for (let i = 0; i < px.length; i += 4) {
          if (px[i] !== blank[i] || px[i + 1] !== blank[i + 1] || px[i + 2] !== blank[i + 2]) {
            return true
          }
        }
        return false
      }

      const culled = scene.order.filter((id) => !isVisible(scene.shapes[id], view, zoom))
      const guilty: string[] = []
      const bisect = (ids: string[]): void => {
        if (guilty.length >= 3 || !paintsSomething(ids)) return
        if (ids.length === 1) {
          guilty.push(ids[0])
          return
        }
        const mid = Math.floor(ids.length / 2)
        bisect(ids.slice(0, mid))
        bisect(ids.slice(mid))
      }
      bisect(culled)

      for (const id of guilty) {
        const shape = scene.shapes[id]
        const b = getWorldBounds(shape)
        mismatches.push(
          `zoom=${zoom} step=${step}: ${shape.type} ${id}를 버렸지만 화면에 그려진다 ` +
            `(box ${b.x.toFixed(1)},${b.y.toFixed(1)} ${b.width.toFixed(1)}×${b.height.toFixed(1)}, ` +
            `pad ${renderPadOf(shape, zoom).toFixed(2)})`,
        )
      }
    }
  }

  return { checks, mismatches }
}

function verifyIndex(scene: Scene, area: number, seed: number): VerifyResult {
  const mismatches: string[] = []
  let checks = 0
  let state = seed >>> 0
  const rand = (): number => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }

  for (const zoom of [0.25, 1, 4]) {
    for (let i = 0; i < 400; i++) {
      const p: Point = { x: rand() * area, y: rand() * area }
      checks++
      const viaIndex = pickTopmost(scene, p, zoom)
      const viaScan = pickTopmostLinear(scene, p, zoom)
      if (viaIndex?.id !== viaScan?.id) {
        mismatches.push(
          `pickTopmost zoom=${zoom} (${p.x.toFixed(1)},${p.y.toFixed(1)}): ${viaIndex?.id ?? 'null'} ≠ ${viaScan?.id ?? 'null'}`,
        )
      }
    }
  }

  for (let i = 0; i < 200; i++) {
    const rect: Rect = {
      x: rand() * area,
      y: rand() * area,
      width: 10 + rand() * 900,
      height: 10 + rand() * 900,
    }
    checks++
    const viaIndex = pickInRect(scene, rect).join(',')
    const viaScan = pickInRectLinear(scene, rect).join(',')
    if (viaIndex !== viaScan) {
      mismatches.push(`pickInRect (${rect.x.toFixed(1)},${rect.y.toFixed(1)} ${rect.width.toFixed(0)}×${rect.height.toFixed(0)})`)
    }
  }

  return { checks, mismatches: mismatches.slice(0, 10) }
}

/**
 * 컬링이 잘못 버린 도형을 실제로 그려보며 찾아낸다.
 *
 * `renderPad`가 모자란지 아닌지는 눈으로 알 수 없다. 버려진 도형만 모아 그려서
 * 화면에 색이 칠해지면 그중에 버리면 안 될 것이 있다는 뜻이고, 그 집합을
 * 반씩 갈라 들어가면 범인이 나온다. 도형 하나씩 그려보면 1만 번이지만
 * 이분 탐색이면 몇십 번이다.
 */
function makeCanvas(
  width = VIEWPORT.width * DPR,
  height = VIEWPORT.height * DPR,
  readback = false,
): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', readback ? { willReadFrequently: true } : undefined)
  if (!ctx) throw new Error('2d 컨텍스트를 만들 수 없습니다')
  return ctx
}

/** 씬 전체가 화면에 들어오는 카메라 */
function fitCamera(area: number): Camera {
  const zoom = VIEWPORT.width / (area * 1.05)
  return { x: -20, y: -20, zoom }
}

function renderState(
  scene: Scene,
  camera: Camera,
  patch: Partial<EditorState> = {},
): EditorState {
  return {
    ...getState(),
    scene,
    camera,
    selection: [],
    draft: null,
    marquee: null,
    editingId: null,
    active: [],
    ...patch,
  }
}

/** 도형 몇 개를 뺀 씬. 정적 레이어에 남아 있어야 할 것의 독립적인 정답이다 */
function withoutShapes(scene: Scene, ids: string[]): Scene {
  const drop = new Set(ids)
  const order = scene.order.filter((id) => !drop.has(id))
  const shapes: Record<string, Shape> = {}
  for (const id of order) shapes[id] = scene.shapes[id]
  return { shapes, order }
}

/** 도형 몇 개를 옮긴 씬 */
function withMoved(scene: Scene, ids: string[], dx: number, dy: number): Scene {
  const shapes = { ...scene.shapes }
  for (const id of ids) {
    const s = shapes[id]
    shapes[id] = { ...s, x: s.x + dx, y: s.y + dy }
  }
  return { shapes, order: scene.order }
}

/**
 * 정적 레이어가 낡았는지 판단하는 규칙이 맞는지 확인한다.
 *
 * **재는 것은 그리기가 아니라 캐시 무효화다.** 활성 레이어는 매 프레임 새로
 * 그려지므로 낡을 수가 없고, 조용히 틀리는 쪽은 언제나 정적 레이어다 — 다시
 * 그려야 할 때 그리지 않으면 화면에 옛 픽셀이 그대로 남고 아무 오류도 나지
 * 않는다. 그래서 상태를 순서대로 밀어 넣으며 **매 단계 정적 레이어의 픽셀을
 * "그 시점에 남아 있어야 할 도형만 통짜로 그린 화면"과 맞대 본다.**
 *
 * 정답은 `renderScene`이 아니라 `withoutShapes`가 만든다. 레이어 코드가 아니라
 * "활성 집합을 뺀 나머지"라는 정의에서 나온 답이라, 검사가 검사하려는 코드를
 * 그대로 타지 않는다(`verifyCulling`이 한 번 빠졌던 함정이다).
 *
 * 합성 결과가 아니라 정적 레이어만 보는 것도 의도다. 두 캔버스를 겹쳐 읽으면
 * 투명 캔버스를 한 번 거친 만큼 알파가 두 번 반올림되어 1~2/255가 어긋나고,
 * **임계값이 필요 없는 판정이 있으면 그쪽이 낫다.** 같은 크기 캔버스끼리의
 * 불투명 렌더 비교는 정확히 같아야 한다.
 */
function verifyLayers(scene: Scene, area: number): VerifyResult {
  const w = 400
  const h = 300
  const size = { width: w, height: h }
  const mismatches: string[] = []
  let checks = 0

  const staticCtx = makeCanvas(w, h, true)
  const activeCtx = makeCanvas(w, h, true)
  const expectedCtx = makeCanvas(w, h, true)
  const layers = createLayers(staticCtx, activeCtx)
  const epoch = getState().staticEpoch

  for (const zoom of [0.5, 1, 2]) {
    const camera: Camera = { x: area * 0.25, y: area * 0.35, zoom }
    const view = viewportWorldRect(camera, w, h)
    const visible = scene.order.filter((id) => isVisible(scene.shapes[id], view, zoom))
    if (visible.length < 4) continue

    // 화면에 걸리는 도형 셋을 함께 끄는 상황
    const dragged = visible.slice(0, 3)
    const moved = withMoved(scene, dragged, 40 / zoom, 25 / zoom)
    // 드래그 도중 되돌리기 — 활성 집합 밖의 도형이 바뀌는 유일한 정상 경로
    const undone = withMoved(moved, [visible[3]], -60 / zoom, 15 / zoom)

    /*
     * 실제 조작이 스토어에 남기는 순서 그대로다.
     * 활성 집합과 선택을 함께 넣어 **선택 UI가 정적 레이어로 새지 않는지**도
     * 같이 본다 — 정답 쪽 상태는 선택이 비어 있다.
     */
    const steps: { label: string; state: EditorState; expected: Scene }[] = [
      {
        label: '잡기 전',
        state: renderState(scene, camera),
        expected: scene,
      },
      {
        label: '드래그 중',
        state: renderState(moved, camera, { active: dragged, selection: dragged }),
        expected: withoutShapes(moved, dragged),
      },
      {
        label: '드래그 중 되돌리기',
        state: renderState(undone, camera, {
          active: dragged,
          selection: dragged,
          staticEpoch: epoch + 1,
        }),
        expected: withoutShapes(undone, dragged),
      },
      {
        label: '놓은 뒤',
        state: renderState(undone, camera, {
          active: [],
          selection: dragged,
          staticEpoch: epoch + 1,
        }),
        expected: undone,
      },
    ]

    for (const step of steps) {
      layers.render(step.state, size, 1)
      renderScene(expectedCtx, renderState(step.expected, camera), size, 1)
      checks++

      const got = staticCtx.getImageData(0, 0, w, h).data
      const want = expectedCtx.getImageData(0, 0, w, h).data
      let worst = 0
      let at = -1
      for (let i = 0; i < got.length; i++) {
        const delta = Math.abs(got[i] - want[i])
        if (delta > worst) {
          worst = delta
          at = i
        }
      }
      if (worst > 0) {
        const px = at >> 2
        mismatches.push(
          `zoom=${zoom} '${step.label}': 정적 레이어가 통짜 렌더와 다름 ` +
            `(최대 ${worst}/255, 픽셀 ${px % w},${Math.floor(px / w)})`,
        )
      }
    }
  }

  return { checks, mismatches: mismatches.slice(0, 10) }
}

export type BenchResult = {
  options: SeedOptions
  shapeCount: number
  /** 씬 전체가 보이는 배율 — 모든 도형이 그려지는 최악의 경우 */
  renderFit: Stats
  /** 배율 1 — 화면에 실제로 걸리는 도형만 그리면 되는 경우 */
  render1x: Stats
  /** 배율 1에서 화면을 가로질러 팬하며 그리기 */
  renderPan: Stats
  /** 도형 하나를 끄는 동안의 한 프레임 — 활성 레이어만 다시 그린다 */
  renderDrag: Stats
  /** 대조군: 같은 상황을 레이어 없이 통짜로 다시 그리기 */
  renderDragFull: Stats
  /** 빈 곳 클릭 — 전부 검사하고 아무것도 못 찾는 최악의 픽 */
  pickMiss: Stats
  /** 도형이 몰린 곳 클릭 */
  pickHit: Stats
  /** 마퀴 드래그 한 프레임 — 드래그 중 매 프레임 도는 유일한 O(n) */
  marquee: Stats
  /** 씬이 바뀐 직후 첫 픽 — 공간 인덱스를 다시 세우는 비용이 붙는다 */
  pickCold: Stats
  /** 대조군: 공간 인덱스 없이 전체를 훑던 방식 */
  pickMissLinear: Stats
  marqueeLinear: Stats
  /** 인덱스를 거친 결과가 전체를 훑은 결과와 같은지 */
  verify: VerifyResult
  /** 컬링이 보여야 할 도형을 지우지 않았는지 */
  verifyCull: VerifyResult
  /** 정적 레이어가 다시 그려야 할 때를 놓치지 않았는지 */
  verifyLayers: VerifyResult
}

/**
 * 드래그 한 프레임을 재기 위한 씬들.
 *
 * 미리 만들어 두는 이유는 **씬 얕은 복사가 렌더 시간을 덮기 때문**이다. 앱도
 * 매 프레임 `{ ...scene.shapes }`를 하지만 그건 이 항목이 재려는 비용이 아니다.
 * 개수를 8로 묶은 것은 도형 4만 개에서 맵 복사본이 메모리를 잡아먹지 않게.
 */
const DRAG_FRAMES = 8

function dragScenes(scene: Scene, id: string): Scene[] {
  const base = scene.shapes[id]
  const frames: Scene[] = []
  for (let i = 0; i < DRAG_FRAMES; i++) {
    const moved = { ...base, x: base.x + i * 3, y: base.y + i * 2 }
    frames.push({ shapes: { ...scene.shapes, [id]: moved }, order: scene.order })
  }
  return frames
}

export function runBench(opts: Partial<SeedOptions> = {}): BenchResult {
  const options = { ...DEFAULT_SEED, ...opts }
  const scene = seedScene(options)
  const ctx = makeCanvas()

  const fit = fitCamera(options.area)
  const oneX: Camera = { x: options.area / 2, y: options.area / 2, zoom: 1 }

  const renderFit = measure(30, 5, () => {
    renderScene(ctx, renderState(scene, fit), VIEWPORT, DPR)
  })

  const render1x = measure(60, 10, () => {
    renderScene(ctx, renderState(scene, oneX), VIEWPORT, DPR)
  })

  // 팬은 매 프레임 카메라가 달라져 컬링 결과가 계속 바뀐다.
  // 한 자리에 고정한 측정이 놓치는 "경계에 걸친 도형" 비용이 여기서 잡힌다
  const renderPan = measure(60, 10, (i) => {
    const camera: Camera = { x: (i * 37) % options.area, y: (i * 53) % options.area, zoom: 1 }
    renderScene(ctx, renderState(scene, camera), VIEWPORT, DPR)
  })

  /*
   * 드래그 중 한 프레임.
   *
   * 앱에서 가장 자주 도는 프레임이고, 레이어 분리가 겨냥한 바로 그 상황이다.
   * 두 항목이 **같은 씬·같은 카메라·같은 프레임 배열**을 쓰므로 차이는 오직
   * "정적 레이어를 다시 그리는가"에서만 나온다.
   *
   * 상태 객체는 매번 새로 만들지만 `camera`·`active`·`staticEpoch`는 같은 것을
   * 넘긴다 — 스토어가 드래그 중에 실제로 그렇게 두기 때문이고, 이게 달라지면
   * 정적 레이어가 매 프레임 다시 그려져 측정이 대조군과 같아진다.
   */
  const view1x = viewportWorldRect(oneX, VIEWPORT.width, VIEWPORT.height)
  const dragId = scene.order.find((id) => isVisible(scene.shapes[id], view1x, 1)) ?? scene.order[0]
  const dragActive = [dragId]
  const frames = dragScenes(scene, dragId)
  const layers = createLayers(makeCanvas(), makeCanvas())

  const renderDrag = measure(60, 10, (i) => {
    layers.render(renderState(frames[i % DRAG_FRAMES], oneX, { active: dragActive }), VIEWPORT, DPR)
  })

  const renderDragFull = measure(60, 10, (i) => {
    renderScene(ctx, renderState(frames[i % DRAG_FRAMES], oneX), VIEWPORT, DPR)
  })

  // 픽은 배율 1 기준. 화면 좌표를 월드로 바꿔 실제 클릭과 같은 경로를 탄다
  const emptySpot: Point = { x: -500, y: -500 }
  // 인덱스가 루트에서 바로 잘라내 한 번이 나노초 단위다. 크게 묶어야 눈금에 걸린다
  const pickMiss = measureBatched(50, 10, 2000, () => {
    pickTopmost(scene, emptySpot, 1)
  })

  const center: Point = { x: options.area / 2, y: options.area / 2 }
  const pickHit = measureBatched(50, 10, 100, (i) => {
    // 매번 조금씩 다른 자리를 찍어 한 도형에만 유리한 결과가 나오지 않게 한다
    pickTopmost(scene, { x: center.x + (i % 40), y: center.y + ((i * 7) % 40) }, 1)
  })

  const marqueeRect = { x: options.area / 2, y: options.area / 2, width: 800, height: 600 }
  const marquee = measureBatched(50, 10, 20, (i) => {
    pickInRect(scene, { ...marqueeRect, width: 800 + (i % 50), height: 600 + (i % 50) })
  })

  // 편집 직후의 첫 클릭. 공간 인덱스를 쓰기 시작하면서 생긴 비용이라
  // 반드시 같이 재야 한다 — 질의가 빨라져도 여기가 더 비싸면 손해다
  const pickCold = measure(30, 5, (i) => {
    clearSceneIndexCache()
    pickTopmost(scene, { x: center.x + (i % 40), y: center.y + ((i * 7) % 40) }, 1)
  })

  const pickMissLinear = measureBatched(50, 10, 20, () => {
    pickTopmostLinear(scene, emptySpot, 1)
  })

  const marqueeLinear = measureBatched(50, 10, 20, (i) => {
    pickInRectLinear(scene, { ...marqueeRect, width: 800 + (i % 50), height: 600 + (i % 50) })
  })

  return {
    options,
    shapeCount: scene.order.length,
    renderFit,
    render1x,
    renderPan,
    renderDrag,
    renderDragFull,
    pickMiss,
    pickHit,
    marquee,
    pickCold,
    pickMissLinear,
    marqueeLinear,
    verify: verifyIndex(scene, options.area, options.seed),
    verifyCull: verifyCulling(scene, options.area),
    verifyLayers: verifyLayers(scene, options.area),
  }
}

/** 씬을 실제 에디터에 밀어 넣는다. 손으로 만져보며 체감을 확인할 때 쓴다 */
export function loadBenchScene(opts: Partial<SeedOptions> = {}): number {
  const scene = seedScene({ ...DEFAULT_SEED, ...opts })
  actions.setSelection([])
  actions.setScene(scene)
  return scene.order.length
}
