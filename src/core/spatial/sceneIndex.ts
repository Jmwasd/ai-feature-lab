import { boundsOfPoints, getWorldBounds, type Rect } from '../geometry'
import type { Scene, Shape } from '../types'
import { Quadtree } from './quadtree'

/**
 * 씬의 공간 인덱스.
 *
 * **인덱스는 후보를 좁히기만 한다.** 최종 판정은 여전히 `hitTest`가 한다.
 * 그래서 인덱스가 들고 있는 사각형은 실제 판정 영역보다 **넉넉하기만 하면 된다** —
 * 모자라면 도형을 놓치지만, 남으면 후보가 몇 개 늘 뿐이다. 이 비대칭이
 * 여유 폭을 대충 크게 잡아도 되는 근거다.
 */
export type SceneIndex = {
  query(rect: Rect): string[]
  /** z-order상의 위치. 후보를 그리기 순서대로 세울 때 쓴다 */
  zOf(id: string): number
  size: number
}

/**
 * 인덱스에 넣을 때 쓰는 여유 폭.
 *
 * 얇은 도형의 판정 여유는 `max(strokeWidth / 2, HIT_PAD_PX / zoom)`인데,
 * 인덱스는 zoom을 모르므로 zoom과 무관한 쪽(`strokeWidth`)만 여기서 감당하고
 * 화면 기준 여유는 질의하는 쪽이 넓혀서 온다. 둘을 더하면 원래 `max`보다 크므로
 * 후보를 놓치지 않는다.
 */
function indexSlack(shape: Shape): number {
  return 'strokeWidth' in shape ? shape.strokeWidth : 0
}

function build(scene: Scene): SceneIndex {
  const zIndex = new Map<string, number>()
  const entries: { id: string; bounds: Rect }[] = []
  const corners: { x: number; y: number }[] = []

  for (let z = 0; z < scene.order.length; z++) {
    const id = scene.order[z]
    const shape = scene.shapes[id]
    if (!shape) continue
    zIndex.set(id, z)

    const b = getWorldBounds(shape)
    const slack = indexSlack(shape)
    const bounds: Rect = {
      x: b.x - slack,
      y: b.y - slack,
      width: b.width + slack * 2,
      height: b.height + slack * 2,
    }
    entries.push({ id, bounds })
    corners.push({ x: bounds.x, y: bounds.y }, { x: bounds.x + bounds.width, y: bounds.y + bounds.height })
  }

  const root = corners.length > 0 ? boundsOfPoints(corners) : { x: 0, y: 0, width: 1, height: 1 }
  const tree = new Quadtree(root)
  for (const entry of entries) tree.insert(entry.id, entry.bounds)

  return {
    query: (rect) => tree.query(rect),
    zOf: (id) => zIndex.get(id) ?? -1,
    size: tree.size,
  }
}

/**
 * 씬 하나당 인덱스 하나를 만들어 재사용한다.
 *
 * 씬 객체의 동일성으로 캐시한다. 드래그 중에는 매 프레임 새 씬이 만들어지지만
 * **그때는 아무도 질의하지 않는다** — 픽은 포인터를 누를 때, 마퀴는 씬이
 * 그대로인 동안에만 돈다. 그래서 실제 재구축 횟수는 프레임 수가 아니라
 * "씬이 바뀐 뒤 처음 집는 횟수"다. 미리 만들지 않고 질의할 때 만드는 이유다.
 *
 * 캐시가 하나뿐인 것은 의도다. 되돌리기로 옛 씬이 돌아오면 다시 만들면 되고,
 * 여러 벌을 들고 있으면 지워진 씬이 메모리에 남는다.
 */
let cache: { scene: Scene; index: SceneIndex } | null = null

export function getSceneIndex(scene: Scene): SceneIndex {
  if (cache?.scene === scene) return cache.index
  const index = build(scene)
  cache = { scene, index }
  return index
}

/** 측정용. 캐시를 비워 재구축 비용을 잴 수 있게 한다 */
export function clearSceneIndexCache(): void {
  cache = null
}
