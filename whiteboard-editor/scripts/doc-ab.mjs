/**
 * 폴더별 CLAUDE.md A/B 러너.
 *
 *   node scripts/doc-ab.mjs                  조건당 5회
 *   node scripts/doc-ab.mjs --runs 3
 *   node scripts/doc-ab.mjs --dry-run        claude를 부르지 않고 파이프라인만
 *   node scripts/doc-ab.mjs --no-bench       벤치 생략 (빌드만)
 *   node scripts/doc-ab.mjs --report         저장된 결과만 다시 표로
 *
 * 같은 프롬프트를 `exp/docs-on`과 `exp/docs-off`에 주고 토큰·시간·탐색량·품질을
 * 나란히 잰다. 재는 것이 "문서 전체"가 아니라 **폴더별 분할**이라, 루트 CLAUDE.md와
 * ARCHITECTURE.md는 양쪽에 그대로 있다.
 *
 * 시행마다 worktree를 새로 만드는 이유는 이전 시행의 결과가 다음 시행의 출발점이
 * 되면 안 되기 때문이다. 5회를 같은 디렉토리에서 돌리면 두 번째부터는 이미
 * opacity가 구현된 코드를 보게 된다.
 */
import { spawn } from 'node:child_process'
import { mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { score } from './doc-ab-score.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_OUT = '/private/tmp/claude-501/-Users-jangmin-u-lab-ai/929e4b00-b71e-458d-ade9-92e29ba85e19/scratchpad/doc-ab'

/**
 * 양쪽 조건에 글자 하나까지 같게 주는 프롬프트.
 *
 * 일부러 짧고 열려 있다. "각 도형의 draw에서 globalAlpha를 지정하고…"처럼
 * 상세히 적으면 지시문이 문서를 대신해버려 재려던 것이 사라진다.
 */
const TASK = `도형에 불투명도(opacity) 스타일을 추가해줘. 속성 패널에서 0~1 사이 값을 조절할 수 있고, 모든 도형 종류에 적용된다. 기본값은 1이다.`

const CONDITIONS = { on: 'exp/docs-on', off: 'exp/docs-off' }

function parseArgs(argv) {
  const args = {
    runs: 5,
    model: 'claude-opus-5',
    dryRun: false,
    bench: true,
    report: false,
    out: DEFAULT_OUT,
    timeoutMs: 20 * 60 * 1000,
  }
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i]
    if (flag === '--runs') args.runs = Number(argv[++i])
    else if (flag === '--model') args.model = argv[++i]
    else if (flag === '--dry-run') args.dryRun = true
    else if (flag === '--no-bench') args.bench = false
    else if (flag === '--report') args.report = true
    else if (flag === '--out') args.out = argv[++i]
    else if (flag === '--timeout') args.timeoutMs = Number(argv[++i]) * 1000
    else throw new Error(`알 수 없는 플래그: ${flag}`)
  }
  if (!Number.isFinite(args.runs) || args.runs < 1) throw new Error(`--runs 값이 올바르지 않습니다`)
  return args
}

/** stdout/stderr를 모으고 exit code를 돌려준다. 실패해도 예외를 던지지 않는다 */
function run(cmd, cmdArgs, opts = {}) {
  return new Promise((resolve) => {
    const proc = spawn(cmd, cmdArgs, { cwd: opts.cwd ?? ROOT, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    let timer = null
    let timedOut = false

    if (opts.timeoutMs) {
      timer = setTimeout(() => {
        timedOut = true
        proc.kill('SIGTERM')
        // SIGTERM을 무시하는 경우가 있어 확실히 끊는다
        setTimeout(() => proc.kill('SIGKILL'), 5000)
      }, opts.timeoutMs)
    }

    proc.stdout.on('data', (chunk) => {
      stdout += chunk
      opts.onStdout?.(String(chunk))
    })
    proc.stderr.on('data', (chunk) => {
      stderr += chunk
    })
    proc.on('error', (error) => {
      if (timer) clearTimeout(timer)
      resolve({ code: -1, stdout, stderr: String(error), timedOut })
    })
    proc.on('close', (code) => {
      if (timer) clearTimeout(timer)
      resolve({ code, stdout, stderr, timedOut })
    })
  })
}

/**
 * stream-json 로그에서 필요한 것만 뽑는다.
 *
 * 토큰·시간은 마지막 result 이벤트에, 탐색량은 중간 assistant 이벤트의
 * tool_use에 있다. **탐색량이 문서 효과의 직접 증거다** — 문서가 값을 한다면
 * 문서 없는 쪽에서 Read/Grep이 늘어야 한다.
 */
function parseLog(text) {
  const tools = {}
  const filesRead = new Set()
  const foldersTouched = new Set()
  let result = null
  let malformed = 0

  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    let event
    try {
      event = JSON.parse(line)
    } catch {
      malformed++
      continue
    }

    if (event.type === 'result') result = event

    const content = event.message?.content
    if (!Array.isArray(content)) continue
    for (const block of content) {
      if (block.type !== 'tool_use') continue
      tools[block.name] = (tools[block.name] ?? 0) + 1

      const path = block.input?.file_path ?? block.input?.path ?? block.input?.notebook_path
      if (typeof path === 'string') {
        filesRead.add(path)
        const folder = path.match(/src\/([a-z]+)\//)
        if (folder) foldersTouched.add(folder[1])
      }
    }
  }

  const usage = result?.usage ?? {}
  return {
    ok: Boolean(result) && result.is_error !== true,
    subtype: result?.subtype ?? null,
    durationMs: result?.duration_ms ?? null,
    durationApiMs: result?.duration_api_ms ?? null,
    numTurns: result?.num_turns ?? null,
    costUsd: result?.total_cost_usd ?? null,
    inputTokens: usage.input_tokens ?? 0,
    outputTokens: usage.output_tokens ?? 0,
    cacheCreate: usage.cache_creation_input_tokens ?? 0,
    cacheRead: usage.cache_read_input_tokens ?? 0,
    tools,
    // 거부가 한쪽에만 몰리면 그 조건은 손발이 묶인 채 비교된 것이다
    denials: result?.permission_denials?.length ?? 0,
    // 탐색 도구만 따로 센다. Edit/Write는 결과물을 쓰는 것이지 찾는 것이 아니다
    searchCalls: (tools.Read ?? 0) + (tools.Grep ?? 0) + (tools.Glob ?? 0),
    toolCalls: Object.values(tools).reduce((a, b) => a + b, 0),
    filesRead: [...filesRead],
    // docs-on에서 이 폴더들의 문서가 로드됐다. 비어 있으면 그 시행은 문서 효과를 재지 못했다
    foldersTouched: [...foldersTouched].sort(),
    malformed,
  }
}

async function setupWorktree(dir, branch) {
  await run('git', ['worktree', 'add', '--detach', dir, branch])
  // 시행마다 npm install을 하면 몇 분씩 걸리고 시행 사이에 조건이 달라진다.
  // 링크로 원본 것을 그대로 쓴다 — 읽기만 하므로 오염되지 않는다
  if (!existsSync(join(dir, 'node_modules'))) {
    await symlink(join(ROOT, 'node_modules'), join(dir, 'node_modules'), 'dir')
  }
}

async function teardownWorktree(dir) {
  await run('git', ['worktree', 'remove', '--force', dir])
  await rm(dir, { recursive: true, force: true })
}

async function runTrial({ condition, index, args, outDir }) {
  const label = `${condition}-${index}`
  const dir = join(outDir, 'wt', label)
  const started = Date.now()
  process.stdout.write(`  [${label}] worktree… `)

  await rm(dir, { recursive: true, force: true })
  await setupWorktree(dir, CONDITIONS[condition])

  const trial = { label, condition, index, task: TASK, model: args.model }

  try {
    if (args.dryRun) {
      process.stdout.write('dry-run 건너뜀 · ')
      trial.agent = { ok: true, dryRun: true }
    } else {
      process.stdout.write('claude… ')
      const claude = await run(
        'claude',
        [
          '-p',
          TASK,
          '--output-format',
          'stream-json',
          '--verbose',
          '--model',
          args.model,
          '--permission-mode',
          'acceptEdits',
          // headless에서는 권한을 물을 수 없어 그냥 거부된다. 타입체크를 못 돌리면
          // 스스로 고칠 기회가 사라지므로 검증 명령만 열어 준다 (양쪽 조건 동일)
          '--allowedTools',
          'Bash(npm run build),Bash(npm run lint),Bash(npx tsc:*)',
        ],
        { cwd: dir, timeoutMs: args.timeoutMs },
      )
      const logPath = join(outDir, 'logs', `${label}.jsonl`)
      await writeFile(logPath, claude.stdout)
      trial.agent = { ...parseLog(claude.stdout), exitCode: claude.code, timedOut: claude.timedOut }
      if (claude.timedOut) trial.agent.ok = false
      if (claude.stderr.trim()) {
        await writeFile(join(outDir, 'logs', `${label}.stderr.txt`), claude.stderr)
      }
      process.stdout.write(`${trial.agent.numTurns ?? '?'}턴 · `)
    }

    // 검증은 에이전트가 무엇을 했든 똑같이 돌린다. 실패도 데이터다
    process.stdout.write('build… ')
    const build = await run('npm', ['run', 'build'], { cwd: dir, timeoutMs: 5 * 60 * 1000 })
    trial.build = { pass: build.code === 0, code: build.code, tail: build.stdout.slice(-1500) + build.stderr.slice(-1500) }

    if (args.bench && !args.dryRun) {
      process.stdout.write('bench… ')
      const bench = await run('npm', ['run', 'bench', '--', '--count', '3000'], {
        cwd: dir,
        timeoutMs: 8 * 60 * 1000,
      })
      trial.bench = { pass: bench.code === 0, code: bench.code, tail: bench.stdout.slice(-2000) }
    }

    trial.score = score(dir)
    // 나중에 사람이 실제 코드를 읽어볼 수 있게 남긴다. 숫자만으로는 왜 그랬는지 모른다
    await run('git', ['add', '-A'], { cwd: dir })
    const diff = await run('git', ['diff', '--cached'], { cwd: dir })
    await writeFile(join(outDir, 'patches', `${label}.patch`), diff.stdout)
    trial.diffLines = diff.stdout.split('\n').length
  } catch (error) {
    trial.error = String(error)
  } finally {
    await teardownWorktree(dir)
  }

  trial.wallMs = Date.now() - started
  const s = trial.score
  console.log(
    `점수 ${s ? `${s.passed}/${s.total}` : '—'} · build ${trial.build?.pass ? '✓' : '✗'}${
      trial.bench ? ` · bench ${trial.bench.pass ? '✓' : '✗'}` : ''
    } · ${(trial.wallMs / 1000).toFixed(0)}s`,
  )
  return trial
}

// ── 표 ────────────────────────────────────────────────────────────────

/**
 * 한글·한자는 터미널에서 두 칸을 차지하는데 `String.length`는 한 글자로 센다.
 * 그대로 padEnd를 쓰면 라벨이 한글일 때 열이 어긋난다.
 */
const width = (s) => [...String(s)].reduce((n, ch) => n + (/[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹯＀-｠￠-￦]/.test(ch) ? 2 : 1), 0)
const pad = (s, n) => String(s) + ' '.repeat(Math.max(0, n - width(s)))
const padStart = (s, n) => ' '.repeat(Math.max(0, n - width(s))) + String(s)

function median(values) {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

const num = (v) => (v === null || v === undefined ? '—' : Math.round(v).toLocaleString())

/** 중앙값과 범위를 한 칸에. 평균은 이상치 하나에 끌려간다 */
function cell(values, format = num) {
  const clean = values.filter((v) => typeof v === 'number' && Number.isFinite(v))
  if (clean.length === 0) return '—'
  const mid = median(clean)
  const lo = Math.min(...clean)
  const hi = Math.max(...clean)
  return lo === hi ? format(mid) : `${format(mid)} (${format(lo)}~${format(hi)})`
}

function delta(onValues, offValues) {
  const a = median(onValues.filter(Number.isFinite))
  const b = median(offValues.filter(Number.isFinite))
  if (!a || !b) return '—'
  const pct = ((a - b) / b) * 100
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(0)}%`
}

function printReport(trials) {
  const on = trials.filter((t) => t.condition === 'on')
  const off = trials.filter((t) => t.condition === 'off')
  if (on.length === 0 || off.length === 0) {
    console.log('\n비교할 시행이 모자랍니다.\n')
    return
  }

  const pick = (list, path) => list.map((t) => path.split('.').reduce((o, k) => o?.[k], t))

  console.log(`\n\n폴더별 CLAUDE.md A/B — docs-on ${on.length}회 · docs-off ${off.length}회`)
  console.log(`태스크: opacity 스타일 추가 · 모델 ${trials[0]?.model ?? '?'}\n`)

  const W = [26, 24, 24, 8]
  console.log(
    pad('', W[0]) + padStart(`docs-on (n=${on.length})`, W[1]) + padStart(`docs-off (n=${off.length})`, W[2]) + padStart('차이', W[3]),
  )
  console.log('─'.repeat(W[0] + W[1] + W[2] + W[3]))

  const ROWS = [
    ['input 토큰', 'agent.inputTokens'],
    ['캐시 생성 토큰', 'agent.cacheCreate'],
    ['캐시 읽기 토큰', 'agent.cacheRead'],
    ['output 토큰', 'agent.outputTokens'],
    ['턴 수', 'agent.numTurns'],
    ['탐색 호출 (Read·Grep)', 'agent.searchCalls'],
    ['전체 도구 호출', 'agent.toolCalls'],
    ['소요 시간 (초)', 'agent.durationMs', (v) => (v / 1000).toFixed(0)],
    ['비용 (USD)', 'agent.costUsd', (v) => v.toFixed(3)],
  ]

  for (const [label, path, format] of ROWS) {
    const a = pick(on, path)
    const b = pick(off, path)
    console.log(
      pad(label, W[0]) + padStart(cell(a, format ?? num), W[1]) + padStart(cell(b, format ?? num), W[2]) + padStart(delta(a, b), W[3]),
    )
  }

  console.log('')
  const scoreCell = (list) => {
    const values = list.map((t) => t.score?.passed).filter((v) => typeof v === 'number')
    return values.length ? `${median(values)}/6 (${Math.min(...values)}~${Math.max(...values)})` : '—'
  }
  const rate = (list, fn) => `${list.filter(fn).length}/${list.length}`

  console.log(pad('체크리스트 점수', W[0]) + padStart(scoreCell(on), W[1]) + padStart(scoreCell(off), W[2]))
  console.log(
    pad('build 통과', W[0]) +
      padStart(rate(on, (t) => t.build?.pass), W[1]) +
      padStart(rate(off, (t) => t.build?.pass), W[2]),
  )
  if (on.some((t) => t.bench) || off.some((t) => t.bench)) {
    console.log(
      pad('bench 정합성 통과', W[0]) +
        padStart(rate(on, (t) => t.bench?.pass), W[1]) +
        padStart(rate(off, (t) => t.bench?.pass), W[2]),
    )
  }

  console.log('\n항목별 통과 횟수')
  const ids = [...new Set(trials.flatMap((t) => t.score?.checks.map((c) => c.id) ?? []))]
  for (const id of ids) {
    const label = trials.find((t) => t.score)?.score.checks.find((c) => c.id === id)?.label ?? id
    const hit = (list) => list.filter((t) => t.score?.checks.find((c) => c.id === id)?.pass).length
    console.log(pad(`  ${label}`, W[0]) + padStart(`${hit(on)}/${on.length}`, W[1]) + padStart(`${hit(off)}/${off.length}`, W[2]))
  }

  // 이 실험이 겨냥한 실패. 빌드도 벤치도 통과하면서 조용히 틀리는 상태다
  const unsafe = (list) => list.filter((t) => t.score?.checks.find((c) => c.id === 'alpha-order')?.extra?.unsafe).length
  console.log(
    '\n' + pad('  알파가 새는 상태(위험)', W[0]) + padStart(`${unsafe(on)}/${on.length}`, W[1]) + padStart(`${unsafe(off)}/${off.length}`, W[2]),
  )

  console.log('\n실제로 연 폴더 (docs-on에서 어떤 문서가 로드됐는지)')
  for (const trial of on) {
    console.log(`  ${trial.label}: ${trial.agent?.foldersTouched?.join(', ') || '—'}`)
  }
  console.log('')
}

// ── 실행 ──────────────────────────────────────────────────────────────

const args = parseArgs(process.argv.slice(2))
const outDir = args.out
const resultsPath = join(outDir, 'results.json')

if (args.report) {
  printReport(JSON.parse(await readFile(resultsPath, 'utf8')).trials)
  process.exit(0)
}

// 사전 점검 — 여기서 걸러내지 않으면 몇십 분 뒤에 알게 된다
const status = await run('git', ['status', '--porcelain'])
if (status.stdout.trim()) {
  console.error('워킹 트리에 커밋되지 않은 변경이 있습니다. 실험용 스크립트 외에는 정리하고 시작하세요:\n')
  console.error(status.stdout)
  const dirty = status.stdout.split('\n').filter((l) => l.trim() && !l.includes('scripts/doc-ab'))
  if (dirty.length > 0) process.exit(2)
  console.error('(실험 스크립트뿐이므로 계속합니다)\n')
}
for (const branch of Object.values(CONDITIONS)) {
  const check = await run('git', ['rev-parse', '--verify', branch])
  if (check.code !== 0) {
    console.error(`브랜치가 없습니다: ${branch}`)
    process.exit(2)
  }
}

await mkdir(join(outDir, 'logs'), { recursive: true })
await mkdir(join(outDir, 'patches'), { recursive: true })
await mkdir(join(outDir, 'wt'), { recursive: true })

console.log(`\n출력: ${outDir}`)
console.log(`조건당 ${args.runs}회 · 모델 ${args.model}${args.dryRun ? ' · DRY RUN' : ''}${args.bench ? '' : ' · bench 생략'}`)
console.log(`태스크: ${TASK}\n`)

const trials = []
for (let i = 1; i <= args.runs; i++) {
  // ABBA 교차. 한 조건을 몰아서 돌리면 프롬프트 캐시와 기계 상태가 한쪽에 유리해진다
  const order = i % 2 === 1 ? ['on', 'off'] : ['off', 'on']
  console.log(`라운드 ${i}/${args.runs} (${order.join(' → ')})`)
  for (const condition of order) {
    const trial = await runTrial({ condition, index: i, args, outDir })
    trials.push(trial)
    // 중간에 끊겨도 여기까지는 남는다
    await writeFile(resultsPath, JSON.stringify({ task: TASK, model: args.model, trials }, null, 2))
  }
}

printReport(trials)
console.log(`raw: ${resultsPath}`)
console.log(`패치: ${join(outDir, 'patches')}\n`)
