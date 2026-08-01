import type { ToolId } from '../core/types'
import { actions, useEditor } from '../store/editorStore'

const TOOLS: { id: ToolId; label: string; hint: string }[] = [
  { id: 'select', label: '선택', hint: 'V' },
  { id: 'rect', label: '사각형', hint: 'R' },
  { id: 'ellipse', label: '타원', hint: 'O' },
  { id: 'pen', label: '펜', hint: 'P' },
  { id: 'line', label: '선', hint: 'L' },
  { id: 'arrow', label: '화살표', hint: 'A' },
  { id: 'text', label: '텍스트', hint: 'T' },
]

export function Toolbar() {
  const tool = useEditor((s) => s.tool)
  const zoom = useEditor((s) => s.camera.zoom)
  const canUndo = useEditor((s) => s.canUndo)
  const canRedo = useEditor((s) => s.canRedo)
  const count = useEditor((s) => s.scene.order.length)

  return (
    <div className="toolbar">
      <div className="group">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            className={tool === t.id ? 'active' : ''}
            onClick={() => actions.setTool(t.id)}
          >
            {t.label}
            <kbd>{t.hint}</kbd>
          </button>
        ))}
      </div>

      <div className="group">
        <button disabled={!canUndo} onClick={actions.undo}>
          되돌리기
        </button>
        <button disabled={!canRedo} onClick={actions.redo}>
          다시 실행
        </button>
      </div>

      <div className="status">
        <span>{Math.round(zoom * 100)}%</span>
        <span>도형 {count}개</span>
      </div>
    </div>
  )
}
