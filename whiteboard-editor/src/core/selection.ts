import { getSelectionBounds, type Box } from './geometry'
import type { Scene, Shape } from './types'

/**
 * 선택 상태를 조작 대상 상자 하나로 정리한 것.
 *
 * 하나만 골랐으면 도형 자신이 상자다 — 회전까지 그대로 물려받아 핸들이 도형과
 * 함께 기울어진다. 여럿을 골랐으면 회전 없는 공통 바운딩 박스가 상자가 된다.
 *
 * 렌더러와 입력 처리가 **같은 함수를 거쳐야** 화면에 보이는 핸들과 실제로
 * 집히는 핸들이 어긋나지 않는다. 양쪽에서 각자 박스를 계산하면 조건이 하나만
 * 달라져도 조용히 벌어진다.
 */
export type SelectionFrame = {
  box: Box
  /** 상자에 묶인 도형들. 리사이즈는 이 전부에 분배된다 */
  shapes: Shape[]
  /** 회전 핸들을 노출할지. 공통 박스를 통째로 회전하는 것은 아직 없다 */
  rotatable: boolean
}

export function getSelectionFrame(scene: Scene, selection: string[]): SelectionFrame | null {
  const shapes = selection.map((id) => scene.shapes[id]).filter((s): s is Shape => Boolean(s))
  if (shapes.length === 0) return null

  // 하나뿐이면 도형이 곧 상자다. `Shape`는 구조적으로 `Box`이므로 변환이 없다
  if (shapes.length === 1) return { box: shapes[0], shapes, rotatable: true }

  const bounds = getSelectionBounds(shapes)
  if (!bounds) return null
  return { box: { ...bounds, rotation: 0 }, shapes, rotatable: false }
}
