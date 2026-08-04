import { useCallback, useEffect, useRef } from 'react'
import { transformShapes } from '../core/commands'
import type { Shape, StyleField, StyleValue, TextAlign } from '../core/types'
import { measureTextShape } from '../render/textMetrics'
import { applyStyle, styleFieldsOf, supportsStyle } from '../shapes/registry'
import { actions, getState, useEditor } from '../store/editorStore'

/** 선택이 없을 때 편집하는 기본 스타일이 다루는 항목 */
const DEFAULT_FIELDS: StyleField[] = [
  'fill',
  'stroke',
  'strokeWidth',
  'fontSize',
  'fontFamily',
  'align',
]

const FONT_OPTIONS = [
  { value: 'system-ui, -apple-system, sans-serif', label: '기본' },
  { value: 'Georgia, "Times New Roman", serif', label: '세리프' },
  { value: 'ui-monospace, SFMono-Regular, Menlo, monospace', label: '고정폭' },
]

const ALIGN_OPTIONS: { value: TextAlign; label: string }[] = [
  { value: 'left', label: '좌' },
  { value: 'center', label: '중앙' },
  { value: 'right', label: '우' },
]

const ARROW_OPTIONS = [
  { value: 'none', label: '없음' },
  { value: 'end', label: '끝' },
  { value: 'both', label: '양쪽' },
]

/**
 * 여러 도형이 함께 선택됐을 때 보여줄 값.
 * 값이 갈리면 null을 돌려주고 화면에는 "혼합"으로 표시한다.
 */
function commonValue(shapes: Shape[], field: StyleField): StyleValue | null {
  let found: StyleValue | undefined
  for (const shape of shapes) {
    if (!supportsStyle(shape, field)) continue
    const value = (shape as unknown as Record<string, StyleValue>)[field]
    if (found === undefined) found = value
    else if (found !== value) return null
  }
  return found ?? null
}

/**
 * React의 `onChange`는 DOM의 `input` 이벤트다. 색상 피커를 끄는 동안,
 * 숫자를 한 글자씩 고치는 동안 계속 들어오므로 "미리보기"에 해당한다.
 *
 * 조작이 끝나는 시점인 DOM의 `change`는 React가 그대로 노출하지 않아 직접 붙인다.
 * 히스토리에는 이때 한 번만 남겨야 되돌리기가 색 한 단계씩 되감기지 않는다.
 */
function LiveInput({
  onCommit,
  onLive,
  ...rest
}: {
  onCommit: () => void
  onLive: (raw: string) => void
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'>) {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.addEventListener('change', onCommit)
    return () => el.removeEventListener('change', onCommit)
  }, [onCommit])

  return (
    <input ref={ref} onChange={(e) => onLive(e.target.value)} onBlur={onCommit} {...rest} />
  )
}

/**
 * 색·굵기·글꼴 편집 패널.
 *
 * 보여줄 항목은 도형 모듈이 선언한 것(`styleFieldsOf`)에서 나온다.
 * 도형을 추가해도 이 파일은 바뀌지 않는다 — 새 도형이 `styleFields`에
 * 무엇을 적느냐가 곧 패널에 무엇이 뜨느냐다.
 */
export function PropertyPanel() {
  const scene = useEditor((s) => s.scene)
  const selection = useEditor((s) => s.selection)
  const style = useEditor((s) => s.style)

  /** 조작을 시작한 시점의 도형들. 되돌릴 지점이자 히스토리에 남길 before다 */
  const pending = useRef<Shape[] | null>(null)

  const commit = useCallback(() => {
    const before = pending.current
    pending.current = null
    if (!before) return

    const { shapes } = getState().scene
    const after = before.map((s) => shapes[s.id]).filter((s): s is Shape => Boolean(s))
    // 되돌리는 사이에 도형이 사라졌다면 짝이 맞지 않으므로 기록하지 않는다
    if (after.length !== before.length) return
    if (after.every((s, i) => s === before[i])) return

    // 변경은 이미 씬에 반영되어 있다. 히스토리에만 한 번 남긴다
    actions.record(transformShapes(before, after))
  }, [])

  const selected = selection
    .map((id) => scene.shapes[id])
    .filter((shape): shape is Shape => Boolean(shape))

  const setField = (field: StyleField, value: StyleValue) => {
    // 선택이 없으면 앞으로 만들 도형의 기본값을 고친다. 문서가 아니므로 히스토리에 남기지 않는다
    if (selected.length === 0) {
      actions.setStyle({ [field]: value })
      return
    }

    const current = getState().scene
    if (!pending.current) pending.current = selected
    const shapes = { ...current.shapes }
    for (const shape of selected) {
      let next = applyStyle(shapes[shape.id] ?? shape, field, value)
      // 글자 크기나 글꼴이 바뀌면 박스도 다시 재야 선택 영역이 글자를 따라간다
      if (next.type === 'text') next = { ...next, ...measureTextShape(next) }
      shapes[shape.id] = next
    }
    actions.setScene({ ...current, shapes })
  }

  /** 슬라이더가 아닌 버튼·드롭다운은 한 번의 조작으로 끝나므로 바로 확정한다 */
  const setFieldAndCommit = (field: StyleField, value: StyleValue) => {
    setField(field, value)
    commit()
  }

  const fields =
    selected.length === 0
      ? DEFAULT_FIELDS
      : [...new Set(selected.flatMap((shape) => styleFieldsOf(shape.type)))]

  const has = (field: StyleField) => fields.includes(field)

  /** null이면 "혼합". 선택이 없을 때는 기본 스타일 값을 보여준다 */
  const valueOf = (field: StyleField, fallback: StyleValue): StyleValue | null => {
    if (selected.length > 0) return commonValue(selected, field)
    const defaults = style as unknown as Record<string, StyleValue | undefined>
    return defaults[field] ?? fallback
  }

  const colorRow = (field: 'fill' | 'stroke', label: string) => {
    const value = valueOf(field, '#000000')
    return (
      <div className="panel-row">
        <span className="panel-label">{label}</span>
        <LiveInput
          type="color"
          value={typeof value === 'string' ? value : '#000000'}
          onLive={(raw) => setField(field, raw)}
          onCommit={commit}
        />
        {value === null && <span className="panel-mixed">혼합</span>}
      </div>
    )
  }

  const numberRow = (field: 'strokeWidth' | 'fontSize', label: string, step: number) => {
    const value = valueOf(field, step)
    return (
      <div className="panel-row">
        <span className="panel-label">{label}</span>
        <LiveInput
          type="number"
          min={step}
          step={step}
          // 값이 갈릴 때는 비워 둔다. 아무 숫자나 보여주면 그 값으로 통일된 것처럼 보인다
          value={value === null ? '' : Math.round(Number(value) * 100) / 100}
          placeholder="혼합"
          onLive={(raw) => {
            const next = Number(raw)
            if (Number.isFinite(next) && next > 0) setField(field, next)
          }}
          onCommit={commit}
        />
      </div>
    )
  }

  const choiceRow = (
    field: StyleField,
    label: string,
    options: { value: string; label: string }[],
  ) => {
    const value = valueOf(field, options[0].value)
    return (
      <div className="panel-row">
        <span className="panel-label">{label}</span>
        <div className="panel-choice">
          {options.map((option) => (
            <button
              key={option.value}
              className={value === option.value ? 'active' : ''}
              onClick={() => setFieldAndCommit(field, option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="panel">
      <div className="panel-title">
        {selected.length === 0 ? '기본 스타일' : `선택 ${selected.length}개`}
      </div>

      {has('fill') && colorRow('fill', '채움')}
      {has('stroke') && colorRow('stroke', '선 색')}
      {has('strokeWidth') && numberRow('strokeWidth', '굵기', 1)}
      {has('fontSize') && numberRow('fontSize', '글자 크기', 1)}

      {has('fontFamily') && (
        <div className="panel-row">
          <span className="panel-label">글꼴</span>
          <select
            value={String(valueOf('fontFamily', FONT_OPTIONS[0].value) ?? '')}
            onChange={(e) => setFieldAndCommit('fontFamily', e.target.value)}
          >
            {valueOf('fontFamily', '') === null && <option value="">혼합</option>}
            {FONT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {has('align') && choiceRow('align', '정렬', ALIGN_OPTIONS)}
      {has('arrow') && choiceRow('arrow', '화살표', ARROW_OPTIONS)}

      {selected.length === 0 && (
        <p className="panel-hint">
          새로 만들 도형에 적용됩니다. 굵기와 글자 크기는 화면 기준이라 어느 배율에서 그리든 같은
          크기로 보입니다.
        </p>
      )}
    </div>
  )
}
