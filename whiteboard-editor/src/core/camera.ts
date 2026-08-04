import type { Camera, Point } from './types'

export const MIN_ZOOM = 0.1
export const MAX_ZOOM = 8

export function screenToWorld(p: Point, cam: Camera): Point {
  return { x: p.x / cam.zoom + cam.x, y: p.y / cam.zoom + cam.y }
}

export function worldToScreen(p: Point, cam: Camera): Point {
  return { x: (p.x - cam.x) * cam.zoom, y: (p.y - cam.y) * cam.zoom }
}

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
}

/**
 * 커서 아래에 있는 월드 좌표가 화면상 같은 자리에 머무르도록 줌.
 * 이 보정이 없으면 확대할 때 그림이 좌상단으로 빨려 들어간다.
 */
export function zoomAt(cam: Camera, screenPoint: Point, nextZoomRaw: number): Camera {
  const nextZoom = clampZoom(nextZoomRaw)
  const anchor = screenToWorld(screenPoint, cam)
  return {
    zoom: nextZoom,
    x: anchor.x - screenPoint.x / nextZoom,
    y: anchor.y - screenPoint.y / nextZoom,
  }
}

export function panBy(cam: Camera, screenDx: number, screenDy: number): Camera {
  return { ...cam, x: cam.x - screenDx / cam.zoom, y: cam.y - screenDy / cam.zoom }
}
