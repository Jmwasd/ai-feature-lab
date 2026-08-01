import { distanceToSegment } from './geometry'
import type { Point } from './types'

/**
 * Ramer–Douglas–Peucker 곡선 단순화.
 *
 * 포인터 이벤트는 초당 수백 개가 들어오므로 손으로 선 하나만 그어도
 * 점이 수백 개 쌓인다. 그대로 두면 저장 크기와 히트 테스트 비용이
 * 점 개수에 그대로 비례한다.
 *
 * 원리는 단순하다. 양 끝점을 잇는 선분에서 가장 멀리 떨어진 점을 찾고,
 * 그 거리가 허용치보다 작으면 사이의 점들은 전부 버린다.
 * 크면 그 점을 기준으로 둘로 나눠 같은 작업을 반복한다.
 *
 * 점을 새로 만들지 않고 원본 원소를 그대로 통과시키므로,
 * 필압처럼 점에 실린 부가 정보는 저절로 살아남는다.
 */
export function simplifyPath<T extends Point>(points: T[], tolerance: number): T[] {
  if (points.length <= 2) return points

  const first = points[0]
  const last = points[points.length - 1]

  let maxDistance = 0
  let index = 0
  for (let i = 1; i < points.length - 1; i++) {
    const distance = distanceToSegment(points[i], first, last)
    if (distance > maxDistance) {
      maxDistance = distance
      index = i
    }
  }

  if (maxDistance <= tolerance) return [first, last]

  // 분할 지점이 양쪽에 중복으로 들어가므로 왼쪽 결과의 마지막을 잘라낸다
  const left = simplifyPath(points.slice(0, index + 1), tolerance)
  const right = simplifyPath(points.slice(index), tolerance)
  return [...left.slice(0, -1), ...right]
}
