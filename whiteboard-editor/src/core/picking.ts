import { hitTestLocal } from '../shapes/registry'
import { getWorldBounds, rectsIntersect, toLocal, type Rect } from './geometry'
import { getSceneIndex } from './spatial/sceneIndex'
import { HIT_PAD_PX, type Point, type Scene, type Shape } from './types'

/**
 * 회전 상쇄는 여기서 한 번만 하고, 도형별 모듈은 축 정렬 상태만 다룬다.
 * 도형 종류가 늘어나도 회전 처리를 각자 구현하지 않아도 되는 이유다.
 *
 * zoom은 판정 여유 폭을 화면 기준으로 맞추는 데 쓴다. 얇은 획을 어느
 * 배율에서든 같은 감각으로 집으려면 도형이 현재 배율을 알아야 한다.
 */
export function hitTest(shape: Shape, world: Point, zoom: number): boolean {
  return hitTestLocal(shape, toLocal(world, shape), zoom)
}

/**
 * 포인터 한 점을 감싸는 질의 사각형.
 *
 * 점 하나로 질의하면 얇은 선을 놓친다. 판정은 화면 기준 여유를 두고 하는데
 * 인덱스가 그보다 좁게 물으면 **판정에는 걸리는데 후보에는 없는** 도형이 생긴다.
 */
function queryRectAt(p: Point, zoom: number): Rect {
  const slack = HIT_PAD_PX / zoom
  return { x: p.x - slack, y: p.y - slack, width: slack * 2, height: slack * 2 }
}

/**
 * 가장 위에 있는 도형을 반환.
 *
 * 공간 인덱스로 후보를 좁힌 뒤 z-order 역순으로 검사한다. 씬 전체를 훑던
 * 예전 방식과 결과가 같아야 하므로, 인덱스는 판정 영역을 반드시 포함하는
 * 넉넉한 사각형만 담는다(`sceneIndex.ts`).
 */
export function pickTopmost(scene: Scene, p: Point, zoom: number): Shape | null {
  const index = getSceneIndex(scene)
  const candidates = index.query(queryRectAt(p, zoom))
  if (candidates.length === 0) return null

  // 후보만 정렬하므로 전체 도형 수가 아니라 겹친 도형 수에 비례한다
  candidates.sort((a, b) => index.zOf(b) - index.zOf(a))
  for (const id of candidates) {
    const shape = scene.shapes[id]
    if (shape && hitTest(shape, p, zoom)) return shape
  }
  return null
}

/**
 * 마퀴 선택 판정.
 * 회전한 도형은 정확히 하려면 분리축 정리(SAT)가 필요하지만,
 * 선택 UX에서는 AABB 근사로 충분하다.
 *
 * 인덱스가 여유 폭만큼 넓힌 사각형을 들고 있으므로, 걸러낸 후보를
 * 실제 바운딩 박스로 한 번 더 검사해야 예전과 같은 결과가 나온다.
 */
export function pickInRect(scene: Scene, rect: Rect): string[] {
  const index = getSceneIndex(scene)
  const candidates = index.query(rect)
  const hits: string[] = []
  for (const id of candidates) {
    const shape = scene.shapes[id]
    if (shape && rectsIntersect(getWorldBounds(shape), rect)) hits.push(id)
  }
  // 호출부는 z-order 순서를 기대한다. 예전에는 order를 훑어서 저절로 지켜졌다
  hits.sort((a, b) => index.zOf(a) - index.zOf(b))
  return hits
}
