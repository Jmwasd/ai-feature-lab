/**
 * 벤치마크 러너.
 *
 *   npm run bench                 기본(도형 1만 개)
 *   npm run bench -- --count 2000
 *   npm run bench -- --json       기계가 읽을 형태로
 *   npm run bench -- --save base  결과를 파일로 저장
 *   npm run bench -- --diff base  저장해둔 결과와 비교
 *
 * 개발 서버를 직접 띄우고 끄므로 사전 준비가 필요 없다.
 */
import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const RESULT_DIR = join(ROOT, '.bench')

function parseArgs(argv) {
  const args = { count: 10000, area: 6000, seed: 1, json: false, save: null, diff: null }
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i]
    if (flag === '--json') args.json = true
    else if (flag === '--count') args.count = Number(argv[++i])
    else if (flag === '--area') args.area = Number(argv[++i])
    else if (flag === '--seed') args.seed = Number(argv[++i])
    else if (flag === '--save') args.save = argv[++i]
    else if (flag === '--diff') args.diff = argv[++i]
  }
  // 인자가 깨지면 도형 0개를 재고도 표는 멀쩡해 보인다. 여기서 멈추는 편이 낫다
  for (const key of ['count', 'area', 'seed']) {
    if (!Number.isFinite(args[key]) || args[key] <= 0) {
      throw new Error(`--${key} 값이 올바르지 않습니다: ${args[key]}`)
    }
  }
  return args
}

/** vite dev 서버를 띄우고 실제로 열린 주소를 돌려준다 */
function startServer() {
  return new Promise((resolve, reject) => {
    const proc = spawn('npm', ['run', 'dev'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] })
    const timer = setTimeout(() => reject(new Error('dev 서버가 30초 안에 뜨지 않았습니다')), 30000)
    const onData = (chunk) => {
      const match = String(chunk).match(/http:\/\/localhost:(\d+)/)
      if (match) {
        clearTimeout(timer)
        resolve({ proc, url: match[0] + '/' })
      }
    }
    proc.stdout.on('data', onData)
    proc.stderr.on('data', onData)
    proc.on('error', reject)
  })
}

const ROWS = [
  ['renderFit', '렌더 · 전체 보기', '모든 도형이 화면에 걸린 최악의 경우'],
  ['render1x', '렌더 · 배율 1', '화면 밖 도형이 대부분인 일반적인 경우'],
  ['renderPan', '렌더 · 팬 중', '카메라가 매 프레임 움직일 때'],
  ['renderDrag', '렌더 · 드래그 중', '도형 하나를 끄는 동안 — 활성 레이어만 다시 그린다'],
  ['pickMiss', '픽 · 빈 곳 클릭', '전부 검사하고 아무것도 못 찾는 최악'],
  ['pickHit', '픽 · 도형 클릭', ''],
  ['marquee', '마퀴 한 프레임', '드래그 중 매 프레임 도는 유일한 O(n)'],
  ['pickCold', '픽 · 편집 직후', '공간 인덱스를 다시 세우고 나서 하는 첫 클릭'],
]

/**
 * 같은 씬·같은 실행 안에서 재는 A/B.
 * 옛 커밋으로 돌아가 따로 재면 기계 상태와 브라우저 버전이 달라 비교가 흐려진다.
 */
const AB_ROWS = [
  ['픽 · 빈 곳 클릭', 'pickMissLinear', 'pickMiss', '전체 훑기', '인덱스'],
  ['마퀴 한 프레임', 'marqueeLinear', 'marquee', '전체 훑기', '인덱스'],
  ['렌더 · 드래그 중', 'renderDragFull', 'renderDrag', '통짜', '레이어'],
]

/** 마이크로초 단위로 내려가는 항목이 있어 자릿수를 값에 맞춘다 */
const ms = (v) => (v < 0.01 ? `${(v * 1000).toFixed(1)}µs` : `${v.toFixed(3)}ms`)
const pad = (s, n) => String(s).padEnd(n)
const padStart = (s, n) => String(s).padStart(n)

/** 배수 비교. 둘 중 하나가 0에 가까우면 배수가 의미를 잃으므로 표시하지 않는다 */
function compare(before, after) {
  if (!(before > 0) || !(after > 0)) return '—'
  const factor = before / after
  if (factor >= 1.05) return `${factor.toFixed(1)}× 빠름`
  if (factor <= 0.95) return `${(1 / factor).toFixed(1)}× 느림`
  return '≈'
}

function printTable(result, baseline) {
  const budget = 1000 / 60
  console.log(
    `\n도형 ${result.shapeCount.toLocaleString()}개 · 월드 ${result.options.area}² · seed ${result.options.seed}`,
  )
  console.log(`뷰포트 1440×900 · 60fps 예산 ${budget.toFixed(2)}ms\n`)

  const head = `${pad('항목', 20)}${padStart('p50', 11)}${padStart('p95', 11)}${padStart('예산 대비', 12)}`
  console.log(baseline ? `${head}${padStart('변화', 12)}` : head)
  console.log('─'.repeat(baseline ? 66 : 54))

  for (const [key, label] of ROWS) {
    const s = result[key]
    if (!s) continue
    const share = `${((s.p50 / budget) * 100).toFixed(0)}%`
    let line = `${pad(label, 20)}${padStart(ms(s.p50), 11)}${padStart(ms(s.p95), 11)}${padStart(share, 12)}`
    if (baseline?.[key]) line += padStart(compare(baseline[key].p50, s.p50), 12)
    console.log(line)
  }
  if (AB_ROWS.every(([, a, b]) => result[a] && result[b])) {
    console.log(`\n최적화 A/B (같은 씬, 같은 실행)\n`)
    console.log(`${pad('항목', 20)}${padStart('전', 16)}${padStart('후', 16)}${padStart('변화', 12)}`)
    console.log('─'.repeat(64))
    for (const [label, beforeKey, afterKey, beforeName, afterName] of AB_ROWS) {
      const before = result[beforeKey].p50
      const after = result[afterKey].p50
      console.log(
        `${pad(label, 20)}${padStart(`${beforeName} ${ms(before)}`, 16)}${padStart(`${afterName} ${ms(after)}`, 16)}${padStart(compare(before, after), 12)}`,
      )
    }
  }

  console.log('')
  for (const [, label, note] of ROWS) {
    if (note) console.log(`  ${label} — ${note}`)
  }
  console.log('')
}

const args = parseArgs(process.argv.slice(2))
const { proc, url } = await startServer()
let exitCode = 0

try {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } })
  page.on('pageerror', (e) => {
    console.error('페이지 오류:', e.message)
    exitCode = 1
  })
  await page.goto(url)
  await page.waitForFunction(() => Boolean(window.__bench), null, { timeout: 15000 })

  const result = await page.evaluate(
    (opts) => window.__bench.run(opts),
    { count: args.count, area: args.area, seed: args.seed },
  )
  await browser.close()

  let baseline = null
  if (args.diff) {
    try {
      baseline = JSON.parse(await readFile(join(RESULT_DIR, `${args.diff}.json`), 'utf8'))
    } catch {
      console.error(`기준선 '${args.diff}'을 찾을 수 없습니다 — 비교를 건너뜁니다`)
    }
  }

  if (args.json) console.log(JSON.stringify(result, null, 2))
  else printTable(result, baseline)

  // 정합성이 깨지면 속도 숫자는 의미가 없다. 표보다 먼저 눈에 띄어야 한다
  const CHECKS = [
    ['공간 인덱스', result.verify, '전체 훑기와 결과 동일'],
    ['컬링', result.verifyCull, '버린 도형은 화면에 아무것도 그리지 않음'],
    ['레이어 분리', result.verifyLayers, '정적 레이어가 통짜 렌더와 픽셀 단위로 같음'],
  ]
  for (const [label, check, note] of CHECKS) {
    if (!check) continue
    if (check.mismatches.length > 0) {
      console.error(`\n✗ ${label} 정합성 실패 (${check.checks}회 검사)`)
      for (const line of check.mismatches) console.error(`    ${line}`)
      console.error('')
      exitCode = 1
    } else if (!args.json) {
      console.log(`✓ ${label} 정합성 ${check.checks}회 검사 통과 (${note})`)
    }
  }
  if (!args.json) console.log('')

  if (args.save) {
    await mkdir(RESULT_DIR, { recursive: true })
    const path = join(RESULT_DIR, `${args.save}.json`)
    await writeFile(path, JSON.stringify(result, null, 2))
    console.log(`저장: ${path}`)
  }
} catch (error) {
  console.error(error)
  exitCode = 1
} finally {
  proc.kill('SIGTERM')
}

process.exit(exitCode)
