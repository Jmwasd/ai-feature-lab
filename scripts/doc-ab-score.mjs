/**
 * opacity 태스크 결과 채점.
 *
 *   node scripts/doc-ab-score.mjs <대상 디렉토리> [--json]
 *
 * 각 항목은 **폴더별 CLAUDE.md에만 근거가 있는 것**으로 골랐다. 문서 없이도
 * 코드만 읽으면 알 수 있는 것(타입 추가, import 정리)은 점수에 넣지 않는다.
 * 그런 것까지 세면 두 조건이 똑같이 만점을 받아 아무것도 구분하지 못한다.
 *
 * 이 스크립트는 검사 대상 worktree **밖**에서 돌린다. 안에 두면 실험 대상
 * 브랜치의 diff에 섞이고, 에이전트가 채점 기준을 읽어버린다.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const SHAPES = ['rect', 'ellipse', 'path', 'line', 'text']

function read(root, rel) {
  const path = join(root, rel)
  return existsSync(path) ? readFileSync(path, 'utf8') : null
}

/** 한 줄 요약에 넣을 근거. 없으면 빈 문자열 */
function snippet(source, pattern) {
  const match = source?.match(pattern)
  if (!match) return ''
  return match[0].replace(/\s+/g, ' ').trim().slice(0, 90)
}

/**
 * 1. 알파가 그리는 순서를 타지 않는가 — 이 실험의 핵심 항목.
 *
 * `globalAlpha`는 Canvas 전역 상태다. 일부 도형만 지정하면 지정하지 않은 도형이
 * 직전 도형의 알파를 물려받아 **그리는 순서에 따라** 엉뚱하게 반투명해진다.
 * 빌드도 벤치도 통과하고 특정 순서에서만 보이는, 불변식 7의 `lineJoin` 사건과
 * 같은 형태의 버그다.
 *
 * 합격 경로가 둘이라 둘 다 인정한다. 도형 다섯이 각자 지정하거나(문서가 권하는 쪽),
 * 공통 호출부가 도형마다 걸어주거나. 후자도 순서 의존성을 없애므로 옳다.
 */
function checkAlpha(root) {
  const perShape = SHAPES.filter((name) => read(root, `src/shapes/${name}.ts`)?.includes('globalAlpha'))
  const common = ['src/shapes/render.ts', 'src/render/renderer.ts'].filter((rel) =>
    read(root, rel)?.includes('globalAlpha'),
  )

  const pass = perShape.length === SHAPES.length || common.length > 0
  // 조용히 틀리는 상태를 따로 표시한다. 통과/실패보다 이쪽이 알고 싶은 것이다
  const unsafe = perShape.length > 0 && perShape.length < SHAPES.length && common.length === 0
  const none = perShape.length === 0 && common.length === 0

  return {
    id: 'alpha-order',
    label: '알파가 그리는 순서를 타지 않음',
    pass,
    detail: none
      ? 'globalAlpha 없음 — 불투명도가 아예 그려지지 않았거나 다른 방식'
      : unsafe
        ? `위험: ${perShape.length}/5 도형만 지정, 공통 처리 없음 (${perShape.join(',')}) — 순서에 따라 샌다`
        : perShape.length === SHAPES.length
          ? `도형 5개 모두 각자 지정${common.length > 0 ? ` (+ ${common.join(', ')})` : ''}`
          : `공통 호출부에서 처리 (${common.join(', ')})`,
    extra: { perShape, common, unsafe },
  }
}

/**
 * 2. 알파를 되돌리는가.
 *
 * 도형마다 지정해도 도형을 다 그린 뒤 선택 프레임·핸들·그리드가 남은 알파를
 * 물려받을 수 있다. 점수에 넣되 1번보다 가볍게 본다.
 */
function checkAlphaReset(root) {
  const sources = ['src/render/renderer.ts', 'src/shapes/render.ts', 'src/render/layers.ts']
    .map((rel) => [rel, read(root, rel)])
    .filter(([, src]) => src)

  // 복원 방식이 여럿이다. `= 1`로 되돌리는 것, 이전 값을 저장했다 넣는 것
  // (`prevAlpha`), save/restore로 감싸는 것. 뒤의 둘이 오히려 정확하다 —
  // 호출부가 이미 알파를 걸어둔 경우까지 안전하기 때문이다.
  // `= 1`만 찾으면 더 나은 구현을 실패로 처리한다.
  const hit = sources.find(([, src]) => {
    const assigns = [...src.matchAll(/globalAlpha\s*=\s*([^\n;]+)/g)].map((m) => m[1].trim())
    // 값을 거는 대입(shape.opacity 쪽)이 아닌 대입이 하나라도 있으면 복원이다
    const restores = assigns.filter((value) => !/opacity/.test(value))
    if (restores.length > 0) return true
    // save/restore로 감싼 경우
    return /globalAlpha/.test(src) && /\.save\(\)/.test(src) && /\.restore\(\)/.test(src)
  })

  const how = hit
    ? (hit[1].match(/globalAlpha\s*=\s*([^\n;]+)/g) ?? []).map((s) => s.trim()).join(' → ')
    : ''
  return {
    id: 'alpha-reset',
    label: '도형을 그린 뒤 알파를 되돌림',
    pass: Boolean(hit),
    detail: hit ? `${hit[0]} — ${how}` : '복원 없음 — 선택 UI·그리드가 알파를 물려받을 수 있다',
  }
}

/**
 * 3. 패널이 미리보기와 확정을 나누는가 (`ui/CLAUDE.md`).
 *
 * `onChange`는 슬라이더를 끄는 내내 들어온다. 그대로 히스토리에 쌓으면
 * 되돌리기 한 번이 0.05씩 되감긴다. `LiveInput`이 이 분리를 담당한다.
 */
function checkLiveInput(root) {
  const src = read(root, 'src/ui/PropertyPanel.tsx')
  if (!src) return { id: 'live-input', label: '패널이 미리보기/확정을 분리', pass: false, detail: '파일 없음' }
  if (!src.includes('opacity')) {
    return { id: 'live-input', label: '패널이 미리보기/확정을 분리', pass: false, detail: '패널에 opacity 없음' }
  }

  // 헬퍼(numberRow 류)를 거치는 경우: 그 헬퍼가 LiveInput 기반인지 본다
  const helperCall = src.match(/(\w+Row)\(\s*['"]opacity['"]/)
  let viaHelper = false
  if (helperCall) {
    const name = helperCall[1]
    const body = src.match(new RegExp(`const ${name} = \\([\\s\\S]*?\\n  \\}`))
    viaHelper = Boolean(body?.[0].includes('LiveInput'))
  }

  // 직접 쓰는 경우: LiveInput 블록 안에서 opacity를 다루는지
  const direct = /<LiveInput[\s\S]{0,600}?opacity/.test(src) || /opacity[\s\S]{0,300}?<LiveInput/.test(src)

  // 확정만 하는 경로로 처리했으면 조작 내내 히스토리에 쌓인다
  const commitOnly = /setFieldAndCommit\(\s*['"]opacity['"]/.test(src)

  const pass = viaHelper || direct
  return {
    id: 'live-input',
    label: '패널이 미리보기/확정을 분리 (LiveInput)',
    pass,
    detail: viaHelper
      ? `${helperCall[1]}() 경유 — LiveInput 기반`
      : direct
        ? 'LiveInput 직접 사용'
        : commitOnly
          ? 'setFieldAndCommit 직접 호출 — 조작 내내 히스토리에 쌓인다'
          : 'LiveInput 경로 없음',
    extra: { viaHelper, direct, commitOnly },
  }
}

/**
 * 4. 도형 모듈이 styleFields로 선언하는가 (`shapes/CLAUDE.md`).
 *
 * 패널은 선택된 도형들의 `styleFields` 합집합을 그린다. 패널에 직접 하드코딩하면
 * 당장은 보이지만 도형을 추가할 때 규약이 깨진다.
 */
function checkStyleFields(root) {
  const registered = SHAPES.filter((name) => {
    const src = read(root, `src/shapes/${name}.ts`)
    const array = src?.match(/styleFields[^=]*=\s*\[([\s\S]*?)\]/)
    return Boolean(array?.[1].includes('opacity'))
  })
  return {
    id: 'style-fields',
    label: '도형 모듈이 styleFields로 선언',
    pass: registered.length === SHAPES.length,
    detail: `${registered.length}/5 등록${registered.length < SHAPES.length ? ` (누락: ${SHAPES.filter((s) => !registered.includes(s)).join(',')})` : ''}`,
    extra: { registered },
  }
}

/** 5. 새로 만들 도형의 기본값 (`store/CLAUDE.md`) */
function checkStoreDefault(root) {
  const src = read(root, 'src/store/editorStore.ts')
  const hit = src && /opacity\s*:\s*1\b/.test(src)
  return {
    id: 'store-default',
    label: '스토어 기본 스타일에 opacity: 1',
    pass: Boolean(hit),
    detail: hit ? snippet(src, /opacity\s*:\s*1\b/) : '기본값 없음',
  }
}

/** 6. 타입에 자리를 냈는가 — 절차의 첫 단계 */
function checkTypes(root) {
  const src = read(root, 'src/core/types.ts')
  const inStyleField = src && /StyleField[\s\S]{0,400}?['"]opacity['"]/.test(src)
  const inShape = src && /opacity\s*:\s*number/.test(src)
  return {
    id: 'types',
    label: 'StyleField와 Shape에 opacity',
    pass: Boolean(inStyleField && inShape),
    detail: `StyleField ${inStyleField ? '✓' : '✗'} · Shape 필드 ${inShape ? '✓' : '✗'}`,
  }
}

/**
 * 점수에 넣지 않고 기록만 하는 관찰. 문서 근거가 아니라 코드를 읽으면 보이는
 * 것들이라 조건을 가르지 못하지만, 결과물의 질을 사람이 판단할 때 쓸모가 있다.
 */
function observations(root) {
  const panel = read(root, 'src/ui/PropertyPanel.tsx') ?? ''
  const store = read(root, 'src/store/editorStore.ts') ?? ''
  const canvas = read(root, 'src/ui/CanvasView.tsx') ?? ''
  const seed = read(root, 'src/dev/seed.ts') ?? ''

  return {
    // 선택이 없을 때 패널에 뜨는지 (DEFAULT_FIELDS는 별도 배열이라 놓치기 쉽다)
    defaultFields: /DEFAULT_FIELDS[\s\S]{0,300}?opacity/.test(panel),
    // 0~1 범위를 지정했는가 — 기존 numberRow를 그대로 쓰면 min=step=1이라
    // 0을 넣을 수 없고 상한도 없다. 소수 step·max·슬라이더 중 무엇이든 있으면 인정
    rangeBounded:
      /['"]opacity['"][^)\n]{0,80}0\.\d/.test(panel) ||
      /opacity[\s\S]{0,400}?(max=\{?1\b|step=\{?0\.|type="range")/.test(panel) ||
      /(max=\{?1\b|step=\{?0\.|type="range")[\s\S]{0,400}?opacity/.test(panel),
    // 새로 그리는 도형이 기본 스타일을 물려받는가
    newShapeUsesStyle: /opacity/.test(canvas),
    // 벤치 씬 생성기가 필드를 채우는가 (안 채우면 undefined가 알파로 들어간다)
    seedFills: /opacity/.test(seed),
    storeStyleType: /opacity/.test(store),
  }
}

export function score(root) {
  const checks = [
    checkAlpha(root),
    checkAlphaReset(root),
    checkLiveInput(root),
    checkStyleFields(root),
    checkStoreDefault(root),
    checkTypes(root),
  ]
  const passed = checks.filter((c) => c.pass).length
  return { root, checks, passed, total: checks.length, observations: observations(root) }
}

// 직접 실행했을 때만 출력한다. 러너는 score()를 import해서 쓴다
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2)
  const json = args.includes('--json')
  const root = args.find((a) => !a.startsWith('--')) ?? process.cwd()

  if (!existsSync(join(root, 'src'))) {
    console.error(`src/를 찾을 수 없습니다: ${root}`)
    process.exit(2)
  }

  const result = score(root)
  if (json) {
    console.log(JSON.stringify(result, null, 2))
  } else {
    console.log(`\n채점 대상: ${result.root}\n`)
    for (const check of result.checks) {
      console.log(`  ${check.pass ? '✓' : '✗'} ${check.label.padEnd(34)} ${check.detail}`)
    }
    console.log(`\n  점수 ${result.passed}/${result.total}`)
    console.log(`\n  관찰: ${JSON.stringify(result.observations)}\n`)
  }
}
