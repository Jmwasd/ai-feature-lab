import type { Rect } from '../geometry'

/**
 * 사각형을 담는 quadtree.
 *
 * 점이 아니라 **넓이를 가진 사각형**을 담으므로, 한 항목이 여러 사분면에 걸칠 수
 * 있다. 걸치는 항목을 자식마다 복제하면 조회 결과에 중복이 생기고 삽입 비용이
 * 불어난다. 그래서 **자식 하나에 온전히 들어가는 항목만 내려보내고, 걸치는 것은
 * 그 자리에 남긴다.** 큰 도형이 위쪽 노드에 모이는 대신 중복이 없다.
 *
 * R-tree가 더 촘촘히 나누지만 삽입이 복잡하고 재삽입·분할 정책까지 필요하다.
 * 여기서는 씬이 바뀔 때마다 통째로 다시 만드는 방식이라 **삽입이 단순하고 빠른
 * 쪽**이 맞다.
 */

/** 한 노드가 쪼개지기 전까지 담는 항목 수 */
const MAX_ITEMS = 8
/** 좌표가 거의 같은 도형이 뭉쳐 있어도 무한히 쪼개지지 않게 막는다 */
const MAX_DEPTH = 8

type Entry = { id: string; bounds: Rect }

function intersects(a: Rect, b: Rect): boolean {
  return (
    a.x <= b.x + b.width &&
    a.x + a.width >= b.x &&
    a.y <= b.y + b.height &&
    a.y + a.height >= b.y
  )
}

function contains(outer: Rect, inner: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  )
}

class Node {
  entries: Entry[] = []
  children: Node[] | null = null
  readonly bounds: Rect
  readonly depth: number

  constructor(bounds: Rect, depth: number) {
    this.bounds = bounds
    this.depth = depth
  }

  private split(): void {
    const { x, y, width, height } = this.bounds
    const w = width / 2
    const h = height / 2
    this.children = [
      new Node({ x, y, width: w, height: h }, this.depth + 1),
      new Node({ x: x + w, y, width: w, height: h }, this.depth + 1),
      new Node({ x, y: y + h, width: w, height: h }, this.depth + 1),
      new Node({ x: x + w, y: y + h, width: w, height: h }, this.depth + 1),
    ]

    // 이미 들고 있던 항목 중 자식에 온전히 들어가는 것만 내려보낸다
    const staying: Entry[] = []
    for (const entry of this.entries) {
      const child = this.childFor(entry.bounds)
      if (child) child.insert(entry)
      else staying.push(entry)
    }
    this.entries = staying
  }

  /** 이 사각형을 온전히 담는 자식. 걸쳐 있으면 null */
  private childFor(bounds: Rect): Node | null {
    if (!this.children) return null
    for (const child of this.children) {
      if (contains(child.bounds, bounds)) return child
    }
    return null
  }

  insert(entry: Entry): void {
    const child = this.childFor(entry.bounds)
    if (child) {
      child.insert(entry)
      return
    }

    this.entries.push(entry)
    if (!this.children && this.entries.length > MAX_ITEMS && this.depth < MAX_DEPTH) {
      this.split()
    }
  }

  query(rect: Rect, out: string[]): void {
    if (!intersects(this.bounds, rect)) return
    for (const entry of this.entries) {
      if (intersects(entry.bounds, rect)) out.push(entry.id)
    }
    if (!this.children) return
    for (const child of this.children) child.query(rect, out)
  }
}

export class Quadtree {
  private readonly root: Node
  private count = 0

  constructor(bounds: Rect) {
    // 폭이나 높이가 0이면 자식 사분면도 전부 0이 되어 아무것도 담기지 않는다.
    // 도형이 하나뿐이거나 한 줄로 늘어선 씬에서 실제로 생긴다
    this.root = new Node(
      { x: bounds.x, y: bounds.y, width: Math.max(bounds.width, 1), height: Math.max(bounds.height, 1) },
      0,
    )
  }

  insert(id: string, bounds: Rect): void {
    this.root.insert({ id, bounds })
    this.count++
  }

  /**
   * 사각형에 걸치는 항목의 id. 순서는 보장하지 않는다 —
   * z-order가 필요한 호출부가 직접 정렬한다.
   */
  query(rect: Rect): string[] {
    const out: string[] = []
    this.root.query(rect, out)
    return out
  }

  get size(): number {
    return this.count
  }
}
