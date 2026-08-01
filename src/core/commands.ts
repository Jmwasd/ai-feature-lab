import type { Scene, Shape } from './types'

/**
 * undo/redo의 기반이 되는 Command 패턴.
 *
 * 씬 전체를 스냅샷으로 쌓는 방식이 구현은 쉽지만 도형이 늘어날수록
 * 메모리가 선형으로 불어난다. 여기서는 각 커맨드가 자신의 역연산을
 * 직접 알고 있도록 해서 변경분만 들고 있는다.
 * 이 구조는 나중에 CRDT/네트워크 동기화로 넘어갈 때
 * 그대로 "변경 의도"를 전송하는 단위가 된다.
 */
export type Command = {
  readonly name: string
  apply(scene: Scene): Scene
  invert(scene: Scene): Scene
}

export function addShape(shape: Shape): Command {
  return {
    name: 'addShape',
    apply: (scene) => ({
      shapes: { ...scene.shapes, [shape.id]: shape },
      order: [...scene.order, shape.id],
    }),
    invert: (scene) => {
      const shapes = { ...scene.shapes }
      delete shapes[shape.id]
      return { shapes, order: scene.order.filter((id) => id !== shape.id) }
    },
  }
}

export function deleteShapes(ids: string[], removed: Shape[], prevOrder: string[]): Command {
  return {
    name: 'deleteShapes',
    apply: (scene) => {
      const shapes = { ...scene.shapes }
      for (const id of ids) delete shapes[id]
      return { shapes, order: scene.order.filter((id) => !ids.includes(id)) }
    },
    // 삭제 취소는 z-order까지 원래 자리로 되돌려야 한다
    invert: (scene) => {
      const shapes = { ...scene.shapes }
      for (const s of removed) shapes[s.id] = s
      return { shapes, order: [...prevOrder] }
    },
  }
}

/**
 * 리사이즈·회전처럼 이동 하나로 표현되지 않는 변경.
 * 조작 전후의 도형 스냅샷을 짝으로 들고 있는다.
 * 대상이 선택된 도형 몇 개로 한정되므로 씬 전체 스냅샷과는 비용이 다르다.
 */
export function transformShapes(before: Shape[], after: Shape[]): Command {
  const write = (scene: Scene, list: Shape[]): Scene => {
    const shapes = { ...scene.shapes }
    for (const s of list) {
      // 되돌리는 사이에 삭제된 도형은 되살리지 않는다
      if (shapes[s.id]) shapes[s.id] = s
    }
    return { ...scene, shapes }
  }
  return {
    name: 'transformShapes',
    apply: (scene) => write(scene, after),
    invert: (scene) => write(scene, before),
  }
}

export function moveShapes(ids: string[], dx: number, dy: number): Command {
  const translate = (scene: Scene, sx: number, sy: number): Scene => {
    const shapes = { ...scene.shapes }
    for (const id of ids) {
      const s = shapes[id]
      if (s) shapes[id] = { ...s, x: s.x + sx, y: s.y + sy }
    }
    return { ...scene, shapes }
  }
  return {
    name: 'moveShapes',
    apply: (scene) => translate(scene, dx, dy),
    invert: (scene) => translate(scene, -dx, -dy),
  }
}
