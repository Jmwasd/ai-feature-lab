import { useEffect, useRef } from 'react'
import { worldToScreen } from '../core/camera'
import { LINE_HEIGHT_RATIO, type TextShape } from '../core/types'
import { measureTextShape } from '../render/textMetrics'
import { actions, getEditingShape, useEditor } from '../store/editorStore'

/** 빈 텍스트도 커서를 보여줄 최소 폭 */
const MIN_BOX_WIDTH = 8

/**
 * Canvas에는 텍스트 편집기가 없다. 그래서 캔버스 위에 진짜 textarea를 띄우고
 * 카메라 변환에 맞춰 위치·크기·회전을 따라가게 한다.
 *
 * 편집 중인 도형은 렌더러가 건너뛰므로 화면에는 이 textarea만 보인다.
 * 확정 로직은 스토어(`commitTextEditing`)에 있다. 캔버스를 클릭해 편집을
 * 끝내는 경로에서도 같은 처리가 필요하기 때문이다.
 */
export function TextEditor() {
  const editingId = useEditor((s) => s.editingId)
  const shape = useEditor(getEditingShape)
  const camera = useEditor((s) => s.camera)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  /**
   * IME 조합 중인지.
   *
   * `KeyboardEvent.isComposing`이 표준이지만 조합을 끝내는 키에서는 브라우저마다
   * 값이 갈린다. compositionstart/end로 직접 들고 있는 쪽이 확실하다.
   */
  const composing = useRef(false)

  useEffect(() => {
    if (!editingId) return
    // 마운트 직후 포커스를 줘야 도구를 고르자마자 바로 입력할 수 있다
    inputRef.current?.focus()
    inputRef.current?.setSelectionRange(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)
    composing.current = false
  }, [editingId])

  if (!editingId || !shape || shape.type !== 'text') return null

  /** 텍스트는 폰트가 크기를 정한다. 내용이 바뀔 때마다 박스를 다시 재야 한다 */
  const applyText = (text: string) => {
    const next: TextShape = { ...shape, text }
    actions.updateEditingShape({ ...next, ...measureTextShape(next) })
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 캔버스 단축키로 새어 나가지 않게 막는다
    e.stopPropagation()

    /*
     * 조합 중의 Enter와 Escape는 IME의 것이다. 한글에서 Enter는 조합 확정,
     * Escape는 조합 취소를 뜻한다. 여기서 편집을 끝내버리면 확정하려던 글자가
     * 사라지거나, 한 글자 지우려던 Escape가 편집 전체를 닫는다.
     */
    if (composing.current || e.nativeEvent.isComposing) return

    if (e.key === 'Escape' || ((e.metaKey || e.ctrlKey) && e.key === 'Enter')) {
      e.preventDefault()
      actions.commitTextEditing()
    }
  }

  const onCompositionEnd = (e: React.CompositionEvent<HTMLTextAreaElement>) => {
    composing.current = false
    // 조합이 끝나며 확정된 글자로 크기를 한 번 더 맞춘다.
    // 브라우저에 따라 compositionend 뒤에 change가 오지 않는다
    applyText(e.currentTarget.value)
  }

  const screen = worldToScreen({ x: shape.x, y: shape.y }, camera)
  const lineHeight = shape.fontSize * LINE_HEIGHT_RATIO
  const wrapWidth = shape.wrapWidth

  /*
   * 고정 폭일 때는 줄바꿈을 브라우저에 맡긴다. 캔버스 쪽 줄바꿈 규칙과
   * 완전히 같지는 않아서 경계에 걸친 한 단어가 다르게 접힐 수 있지만,
   * 편집기 안에서 캐럿 이동과 선택을 직접 구현하는 것보다 훨씬 낫다.
   */
  const boxWidth = wrapWidth ?? Math.max(shape.width, MIN_BOX_WIDTH) + MIN_BOX_WIDTH

  return (
    <textarea
      ref={inputRef}
      className="text-editor"
      value={shape.text}
      onChange={(e) => applyText(e.target.value)}
      onKeyDown={onKeyDown}
      onCompositionStart={() => {
        composing.current = true
      }}
      onCompositionEnd={onCompositionEnd}
      // 툴바 등 캔버스 밖을 클릭해 편집을 끝내는 경로. 캔버스 클릭은 CanvasView가 처리한다
      onBlur={actions.commitTextEditing}
      wrap={wrapWidth === null ? 'off' : 'soft'}
      spellCheck={false}
      style={{
        left: screen.x,
        top: screen.y,
        width: boxWidth * camera.zoom,
        height: Math.max(shape.height, lineHeight) * camera.zoom,
        fontSize: shape.fontSize * camera.zoom,
        fontFamily: shape.fontFamily,
        lineHeight: LINE_HEIGHT_RATIO,
        color: shape.stroke,
        textAlign: shape.align,
        whiteSpace: wrapWidth === null ? 'pre' : 'pre-wrap',
        // 도형과 같은 중심을 축으로 돌아야 캔버스와 어긋나지 않는다
        transform: `rotate(${shape.rotation}rad)`,
      }}
    />
  )
}
