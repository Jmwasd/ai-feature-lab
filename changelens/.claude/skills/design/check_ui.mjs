#!/usr/bin/env node
// design 스킬 검사기 — guide.md를 기준으로 app/·components/의 디자인 위반을 찾는다.
//
//   node .claude/skills/design/check_ui.mjs                  app/·components/ 전체 (오류가 있으면 exit 1)
//   node .claude/skills/design/check_ui.mjs <경로...>         지정한 파일·폴더만
//   node .claude/skills/design/check_ui.mjs --print-tokens   globals.css에 넣을 토큰 블록 (--tw=3|4로 버전 지정)
//
// 색·간격·모서리·글자 크기·굵기·전환 시간은 전부 guide.md에서 읽는다. 여기에 값을 적지 마라.
// 이 파일에 있는 숫자는 Tailwind 클래스 이름 ↔ px 대응뿐이다.
// 오탐인 줄에는 `ui-check-ignore: <이유>` 주석을 단다.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SKILL_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT = resolve(SKILL_DIR, "../../..");
const GUIDE = join(SKILL_DIR, "guide.md");
const SCAN_ROOTS = ["app", "components"];
const CODE_EXT = new Set([".tsx", ".jsx", ".ts", ".js", ".mjs"]);
const SKIP_DIRS = new Set(["node_modules", ".next", "out"]);
const IGNORE = "ui-check-ignore";

// Tailwind 기본 스케일 → px. v3·v4에서 값이 다른 이름은 두 값을 모두 둔다.
const TW_TEXT = { xs: 12, sm: 14, base: 16, lg: 18, xl: 20, "2xl": 24, "3xl": 30, "4xl": 36, "5xl": 48, "6xl": 60, "7xl": 72, "8xl": 96, "9xl": 128 };
const TW_RADIUS = { none: [0], xs: [2], sm: [2, 4], "": [4], md: [6], lg: [8], xl: [12], "2xl": [16], "3xl": [24], "4xl": [32], full: [9999] };
const TW_WEIGHT = { thin: 100, extralight: 200, light: 300, normal: 400, medium: 500, semibold: 600, bold: 700, extrabold: 800, black: 900 };
const PALETTE = "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const B = "(?<![\\w.$-])"; // 클래스 이름 앞 경계

// ---------------------------------------------------------------------------
// guide.md 읽기
// ---------------------------------------------------------------------------

function die(msg) {
  console.error(`check_ui: ${msg}`);
  process.exit(2);
}

function section(md, n) {
  const start = md.search(new RegExp(`^## ${n}\\.`, "m"));
  if (start < 0) return "";
  const rest = md.slice(start + 1);
  const end = rest.search(/^## /m);
  return end < 0 ? rest : rest.slice(0, end);
}

function expand(range) {
  const [a, b] = range.split(/[–-]/).map(Number);
  if (!b) return [a];
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
}

function loadGuide() {
  if (!existsSync(GUIDE)) die(`guide.md가 없다: ${GUIDE}`);
  const md = readFileSync(GUIDE, "utf8");
  const [s1, s2, s3, s4, s5] = [1, 2, 3, 4, 5].map((n) => section(md, n));

  const tokens = new Map();
  for (const m of s2.matchAll(/^\|\s*`(--[a-z0-9-]+)`\s*\|\s*`(#[0-9a-fA-F]{3,8})`/gm)) tokens.set(m[1], m[2].toLowerCase());

  // §3 표 둘째 칸 "14–16 / 400 / …"의 크기·굵기, §5 본문의 "mono 11" 같은 표기
  const fontSizes = new Set();
  const weights = new Set();
  for (const m of s3.matchAll(/^\|[^|\n]+\|\s*([\d–-]+)\s*\/\s*(\d{3})\b/gm)) {
    expand(m[1]).forEach((n) => fontSizes.add(n));
    weights.add(Number(m[2]));
  }
  for (const m of s5.matchAll(/\b(?:mono|sans)\s+(\d{2})\b/gi)) fontSizes.add(Number(m[1]));

  // §4 "쓰는 값:" 목록과 "48–56px" 같은 범위의 양 끝
  const spacing = new Set([0]);
  for (const m of (s4.match(/쓰는 값:([^\n]*)/)?.[1] ?? "").matchAll(/\d+/g)) spacing.add(Number(m[0]));
  for (const m of s4.matchAll(/(\d+)–(\d+)px/g)) spacing.add(Number(m[1])).add(Number(m[2]));

  const radii = new Set([...(s4.match(/모서리:([^\n]*)/)?.[1] ?? "").matchAll(/(\d+)px/g)].map((m) => Number(m[1])));
  const durations = new Set([...s1.matchAll(/(\d+)ms/g)].map((m) => Number(m[1])));

  const missing = [
    [tokens.size, "§2 토큰 표"], [fontSizes.size, "§3 크기"], [weights.size, "§3 굵기"],
    [spacing.size > 1, "§4 쓰는 값"], [radii.size, "§4 모서리"], [durations.size, "§1 전환 시간"],
  ].filter(([ok]) => !ok).map(([, what]) => what);
  if (missing.length) die(`guide.md에서 ${missing.join(", ")}을(를) 읽지 못했다. 형식이 바뀌었으면 이 스크립트의 loadGuide()를 고친다.`);

  return { tokens, fontSizes, weights, spacing, radii, durations };
}

// ---------------------------------------------------------------------------
// 규칙
// ---------------------------------------------------------------------------

const list = (set) => [...set].sort((a, b) => a - b).join("·");

function spacingPx(v) {
  if (/^\d+(\.\d+)?$/.test(v)) return Number(v) * 4;
  const m = v.match(/^\[(\d+(?:\.\d+)?)px\]$/);
  return m ? Number(m[1]) : null;
}

function radiusOk(size, g) {
  const arb = size.match(/^\[(\d+(?:\.\d+)?)px\]$/);
  if (arb) return g.radii.has(Number(arb[1]));
  const px = TW_RADIUS[size];
  return px === undefined || px.every((p) => g.radii.has(p)); // 모르는 이름은 테마에서 정의한 것으로 본다
}

function ms(v) {
  const m = v.match(/^\[?(\d*\.?\d+)(ms|s)?\]?$/);
  if (!m) return null;
  return m[2] === "s" ? Math.round(Number(m[1]) * 1000) : Number(m[1]);
}

function badTransition(decl, g) {
  const value = decl.slice(decl.indexOf(":") + 1);
  if (/\b(?:all|transform|translate|scale|rotate|opacity|box-shadow|ease(?:-in|-out|-in-out)?|cubic-bezier|steps)\b/.test(value)) return true;
  for (const d of value.matchAll(/(\d*\.?\d+)(ms|s)\b/g)) if (!g.durations.has(ms(d[1] + d[2]))) return true;
  return /^transition\s*:/.test(decl) && !/\blinear\b/.test(value); // 곡선을 안 쓰면 기본값 ease다
}

function buildRules(g) {
  const tokenNames = [...g.tokens.keys()].map((t) => t.slice(2)).sort((a, b) => b.length - a.length).join("|");
  const re = (src) => new RegExp(src, "g");

  return [
    // 색 (§2·§9)
    { id: "raw-color", level: "error", where: "code", re: /\[#[0-9a-fA-F]{3,8}\]|(["'`])#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\1/g, when: (m, c) => !/\b(?:href|to|id|htmlFor)=\{?\s*$/.test(c.line.slice(0, m.index)), msg: () => "색 값을 직접 쓰지 않는다 — §2 토큰 클래스를 쓴다 (§9)" },
    { id: "raw-color", level: "error", where: "css", re: /#[0-9a-fA-F]{3,8}\b/g, when: (_m, c) => !/^\s*--[\w-]+\s*:/.test(c.line), msg: () => "색 값을 직접 쓰지 않는다 — var(--토큰)을 쓴다 (§9)" },
    { id: "raw-color", level: "error", where: "all", re: /\b(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb)\(/g, msg: () => "색 함수를 직접 쓰지 않는다 — §2 토큰을 쓴다 (§9)" },
    { id: "palette", level: "error", where: "code", re: re(`${B}(?:bg|text|border|ring|outline|fill|stroke|divide|from|via|to|decoration|placeholder|caret)-(?:${PALETTE})-\\d{2,3}(?![\\w-])`), msg: () => "Tailwind 기본 팔레트 대신 §2 토큰 클래스를 쓴다 (§9)" },
    { id: "palette", level: "error", where: "code", re: re(`${B}(?:bg|text|border|ring|outline|fill|stroke|divide)-(?:white|black)(?![\\w-])`), msg: () => "white/black 대신 §2 토큰(ink·canvas 등)을 쓴다 (§9)" },
    { id: "accent-border", level: "error", where: "code", re: re(`${B}(?:border|divide|outline|ring)(?:-[xytrblse])?-accent(?![\\w-])`), when: (_m, c) => !/(?:^|:)focus(?:-visible|-within)?:/.test(c.token), msg: () => "앰버는 테두리로 쓰지 않는다 — 포커스 링만 예외 (§1·§9)" },
    { id: "semantic-bg", level: "error", where: "code", re: re(`${B}bg-(?:add|del)(?![\\w-])`), msg: () => "초록·빨강 배경은 diff 줄 토큰(diff-add-bg·diff-del-bg)만 쓴다 (§2)" },
    { id: "translucent", level: "error", where: "code", re: re(`${B}bg-(?:${tokenNames})\\/[\\w\\[\\].]+`), msg: () => "배경 토큰을 반투명하게 쓰지 않는다 — 워시·반투명 표면 금지 (§1·§2)" },
    { id: "dim-text", level: "error", where: "code", re: re(`${B}text-(?:${tokenNames})\\/[\\w\\[\\].]+`), msg: () => "텍스트 토큰을 흐리게 쓰지 않는다 — --muted보다 어두워진다 (§2)" },
    { id: "dim-text", level: "warn", where: "code", re: re(`${B}opacity-(?!100(?![\\w-]))[\\w\\[\\].]+`), msg: () => "opacity는 글자를 --muted보다 어둡게 만들 수 있다 — 대비를 확인한다 (§2)" },

    // 깊이 (§1·§2·§4)
    { id: "shadow", level: "error", where: "code", re: re(`${B}(?:drop-)?shadow(?:-(?!none(?![\\w-]))[\\w./\\[\\]#(),%-]+)?(?![\\w-])`), msg: () => "그림자를 쓰지 않는다 (§1·§4)" },
    { id: "shadow", level: "error", where: "code", re: /\b(?:boxShadow|textShadow)\s*:/g, msg: () => "그림자를 쓰지 않는다 (§1·§4)" },
    { id: "shadow", level: "error", where: "css", re: /\b(?:box-shadow|text-shadow)\s*:(?!\s*none\b)|drop-shadow\(/g, msg: () => "그림자를 쓰지 않는다 (§1·§4)" },
    { id: "gradient", level: "error", where: "code", re: re(`${B}bg-(?:gradient|linear|radial|conic)-[\\w\\[\\]/-]+`), msg: () => "그라디언트 배경 금지 (§2)" },
    { id: "gradient", level: "error", where: "all", re: /\b(?:repeating-)?(?:linear|radial|conic)-gradient\(/g, msg: () => "그라디언트 배경 금지 (§2)" },
    { id: "blur", level: "error", where: "code", re: re(`${B}(?:backdrop-[\\w\\[\\]/.-]+|blur(?:-[\\w\\[\\]/.-]+)?)(?![\\w-])`), msg: () => "반투명 블러 표면 금지 (§2)" },
    { id: "blur", level: "error", where: "css", re: /\b(?:backdrop-filter|filter)\s*:[^;]*blur\(/g, msg: () => "반투명 블러 표면 금지 (§2)" },

    // 움직임 (§1)
    { id: "motion", level: "error", where: "code", re: re(`${B}animate-[\\w\\[\\]-]+`), msg: () => "애니메이션 금지 — 글자는 안 움직인다 (§1)" },
    { id: "motion", level: "error", where: "code", re: re(`${B}transition-(?:all|transform|opacity|shadow)(?![\\w-])`), msg: () => "전환은 색상만 — transition-colors를 쓴다 (§1)" },
    { id: "motion", level: "error", where: "code", re: re(`${B}duration-([\\w\\[\\].]+)`), when: (m) => !g.durations.has(ms(m[1])), msg: () => `전환 시간은 ${list(g.durations)}ms만 (§1)` },
    { id: "motion", level: "error", where: "code", re: re(`${B}ease-(?!linear(?![\\w-]))[\\w\\[\\](),.-]+`), msg: () => "전환은 선형만 — ease-linear (§1)" },
    { id: "motion", level: "warn", where: "code", re: re(`${B}transition(?![\\w-])`), msg: () => "transition은 색 말고도 움직인다 — transition-colors를 쓴다 (§1)" },
    { id: "motion", level: "warn", where: "code", re: re(`${B}transition-colors(?![\\w-])`), when: (_m, c) => !/(?:^|[\s"'`:])ease-linear(?![\w-])/.test(c.line), msg: () => "Tailwind 기본 곡선은 선형이 아니다 — ease-linear를 같이 쓴다 (§1)" },
    { id: "motion", level: "error", where: "css", re: /@keyframes\b|\banimation(?:-name)?\s*:/g, msg: () => "애니메이션 금지 (§1)" },
    { id: "motion", level: "error", where: "css", re: /\btransition(?:-property|-duration|-timing-function)?\s*:[^;]+/g, when: (m) => badTransition(m[0], g), msg: () => `전환은 색상 ${list(g.durations)}ms 선형만 (§1)` },

    // 모서리·간격 (§4)
    { id: "radius", level: "error", where: "code", re: re(`${B}rounded(?:-(?:t|r|b|l|tl|tr|br|bl|s|e|ss|se|es|ee))?(?:-([\\w.]+|\\[[^\\]\\s]+\\]))?(?![\\w-])`), when: (m) => !radiusOk(m[1] ?? "", g), msg: () => `모서리는 ${list(g.radii)}px만 — rounded-md·rounded-xl·rounded-full (§4)` },
    { id: "radius", level: "error", where: "css", re: /\bborder(?:-(?:top|bottom)-(?:left|right))?-radius\s*:\s*([^;]+)/g, when: (m) => [...m[1].matchAll(/(\d*\.?\d+)(px|rem|%)?/g)].some(([, n, u]) => !g.radii.has(u === "rem" ? Number(n) * 16 : u === "%" ? -1 : Number(n))), msg: () => `모서리는 ${list(g.radii)}px만 (§4)` },
    { id: "spacing", level: "error", where: "code", re: re(`${B}-?(?:p|px|py|pt|pr|pb|pl|ps|pe|m|mx|my|mt|mr|mb|ml|ms|me|gap|gap-x|gap-y|space-x|space-y)-([\\w.]+|\\[[^\\]\\s]+\\])(?![\\w-])`), when: (m) => { const p = spacingPx(m[1]); return p !== null && !g.spacing.has(p); }, msg: (m) => `${spacingPx(m[1])}px는 간격 단위 밖이다 — ${list(g.spacing)}px (§4)` },

    // 글자 (§3)
    { id: "font-size", level: "error", where: "code", re: re(`${B}text-(xs|sm|base|lg|xl|[2-9]xl|\\[\\d+(?:\\.\\d+)?px\\])(?![\\w-])`), when: (m) => !g.fontSizes.has(TW_TEXT[m[1]] ?? Number(m[1].slice(1, -3))), msg: () => `글자 크기는 ${list(g.fontSizes)}px만 (§3)` },
    { id: "font-size", level: "error", where: "css", re: /\bfont-size\s*:\s*(\d*\.?\d+)(px|rem)\b/g, when: (m) => !g.fontSizes.has(m[2] === "rem" ? Number(m[1]) * 16 : Number(m[1])), msg: () => `글자 크기는 ${list(g.fontSizes)}px만 (§3)` },
    { id: "font-weight", level: "error", where: "code", re: re(`${B}font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)(?![\\w-])`), when: (m) => !g.weights.has(TW_WEIGHT[m[1]]), msg: () => `굵기는 ${list(g.weights)}만 (§3)` },
    { id: "font-family", level: "error", where: "code", re: re(`${B}font-(?:serif|\\[[^\\]]+\\])(?![\\w-])`), msg: () => "서체는 font-sans(IBM Plex Sans)·font-mono(IBM Plex Mono)만 (§3)" },
    { id: "font-family", level: "error", where: "code", re: /\bfontFamily\s*:/g, msg: () => "서체는 font-sans·font-mono 클래스로만 (§3)" },
    { id: "font-family", level: "error", where: "css", re: /\bfont-family\s*:\s*(?![^;]*var\(--font-)/g, msg: () => "서체는 var(--font-…)로만 (§3)" },

    // 라이트 모드 (§9)
    { id: "light-mode", level: "error", where: "css", re: /prefers-color-scheme/g, msg: () => "다크 한 벌만 — 라이트 모드·두 벌 토큰 금지 (§9)" },
    { id: "light-mode", level: "warn", where: "code", re: re(`${B}dark:`), msg: () => "다크 한 벌이라 dark: 변형은 필요 없다 (§9)" },

    // diff (§4·§5·§9)
    { id: "diff-wrap", level: "error", where: "code", files: /diff/i, re: re(`${B}(?:whitespace-(?:normal|pre-wrap|pre-line|break-spaces)|break-(?:all|words)|wrap-(?:anywhere|break-word))(?![\\w-])`), msg: () => "diff는 줄바꿈하지 않는다 — whitespace-pre + overflow-x-auto (§4·§5)" },
    { id: "diff-highlight", level: "error", where: "code", re: /from\s+["'](?:prismjs|react-syntax-highlighter|shiki|highlight\.js|refractor|prism-react-renderer)/g, msg: () => "diff에 구문 강조를 하지 않는다 (§9)" },

    // 카피 (§6)
    { id: "copy", level: "error", where: "code", re: /\p{Extended_Pictographic}/gu, msg: () => "이모지 금지 (§6)" },
    { id: "copy", level: "error", where: "code", re: /[가-힣][^\S\n]*!(?!=)/g, msg: () => "느낌표 금지 (§6)" },
    { id: "copy", level: "warn", where: "code", re: />\s*-(?=\s*\{|\d)|`-\$\{|(["'])-\1\s*\+/g, msg: () => "감소 표기는 −(U+2212)다 — 하이픈이 아니다 (§6). diff 줄 기호면 무시한다" },
  ];
}

// ---------------------------------------------------------------------------
// 파일 단위 검사
// ---------------------------------------------------------------------------

function tokenAt(line, index, length) {
  // 매치를 감싼 클래스 조각 — hover:border-accent처럼 변형 접두사까지
  let s = index;
  while (s > 0 && !/[\s"'`{}]/.test(line[s - 1])) s--;
  let e = index + length;
  while (e < line.length && !/[\s"'`{}]/.test(line[e])) e++;
  return line.slice(s, e);
}

function scanFile(file, rules, report) {
  const isCss = extname(file) === ".css";
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, i) => {
    if (line.includes(IGNORE)) return;
    const comment = /^\s*(?:\/\/|\/\*|\*)/.test(line);
    for (const rule of rules) {
      const applies =
        rule.where === "all" ||
        (rule.where === "css" && isCss) ||
        (rule.where === "code" && (!isCss || line.includes("@apply")));
      if (!applies || (comment && rule.where !== "css") || (rule.files && !rule.files.test(basename(file)))) continue;
      for (const m of line.matchAll(rule.re)) {
        const ctx = { line, token: tokenAt(line, m.index, m[0].length) };
        if (rule.when && !rule.when(m, ctx)) continue;
        report(file, i + 1, m.index + 1, rule.level, rule.id, rule.msg(m), m[0].trim());
      }
    }
  });
}

function checkTokens(files, g, report) {
  const defined = new Set();
  for (const file of files.filter((f) => extname(f) === ".css")) {
    readFileSync(file, "utf8").split(/\r?\n/).forEach((line, i) => {
      const m = line.match(/^\s*(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;?/);
      if (!m || line.includes(IGNORE)) return;
      defined.add(m[1]);
      const want = g.tokens.get(m[1]);
      if (!want) report(file, i + 1, 1, "error", "token", `guide.md §2에 없는 색 토큰이다`, m[1]);
      else if (m[2].toLowerCase() !== want) report(file, i + 1, 1, "error", "token", `guide.md §2 값은 ${want}다 — --print-tokens로 다시 뽑는다`, `${m[1]}: ${m[2]}`);
    });
  }
  const main = join(PROJECT, "app", "globals.css");
  if (!files.includes(main)) return;
  for (const t of g.tokens.keys()) if (!defined.has(t)) report(main, 1, 1, "error", "token", "토큰 정의가 없다 — --print-tokens 출력을 넣는다", t);
}

function checkFonts(files, report) {
  for (const file of files.filter((f) => CODE_EXT.has(extname(f)))) {
    const src = readFileSync(file, "utf8");
    const imp = src.match(/import\s*\{([^}]*)\}\s*from\s*["']next\/font\/google["']/);
    const names = imp ? imp[1].split(",").map((s) => s.trim().split(/\s+as\s+/)[0]).filter(Boolean) : [];
    const line = imp ? src.slice(0, imp.index).split("\n").length : 1;
    for (const n of names) if (!/^IBM_Plex_(?:Sans|Mono|Sans_KR)$/.test(n)) report(file, line, 1, "error", "font-family", "서체는 IBM Plex Sans·Mono만 — create-next-app 기본 Geist는 지운다 (§3)", n);

    if (file !== join(PROJECT, "app", "layout.tsx")) continue;
    if (!imp && /IBM[-_ ]?Plex/i.test(src)) continue; // next/font/local 등으로 직접 싣는 경우
    const need = [
      ["IBM_Plex_Sans", "IBM Plex Sans를 싣지 않았다 (§3)"],
      ["IBM_Plex_Mono", "IBM Plex Mono를 싣지 않았다 (§3)"],
      ["IBM_Plex_Sans_KR", "한글 폴백 IBM_Plex_Sans_KR이 없다 — Plex에는 한글 글리프가 없어 한글이 시스템 폰트로 떨어진다 (§3)"],
    ];
    for (const [n, msg] of need) if (!names.includes(n)) report(file, line, 1, "error", "font-family", msg, n);
  }
}

function checkDiffFiles(files, report) {
  for (const file of files.filter((f) => /diff/i.test(basename(f)) && /\.[jt]sx$/.test(f))) {
    const src = readFileSync(file, "utf8");
    if (!/(?:^|[\s"'`:])whitespace-pre(?![\w-])/.test(src)) report(file, 1, 1, "warn", "diff-wrap", "diff 줄에 whitespace-pre가 안 보인다 (§3·§5)", basename(file));
    if (!/(?:^|[\s"'`:])overflow-x-auto(?![\w-])/.test(src)) report(file, 1, 1, "warn", "diff-wrap", "diff 블록에 overflow-x-auto가 안 보인다 (§4)", basename(file));
  }
}

// ---------------------------------------------------------------------------
// --print-tokens
// ---------------------------------------------------------------------------

function tailwindMajor(flag) {
  if (flag) return Number(flag);
  const pkg = join(PROJECT, "package.json");
  if (!existsSync(pkg)) return null;
  const { dependencies = {}, devDependencies = {} } = JSON.parse(readFileSync(pkg, "utf8"));
  const v = dependencies.tailwindcss ?? devDependencies.tailwindcss;
  return v ? Number(v.match(/\d+/)?.[0]) : null;
}

function printTokens(g, flag) {
  const major = tailwindMajor(flag);
  const sans = "var(--font-plex-sans), var(--font-plex-kr), sans-serif";
  const mono = "var(--font-plex-mono), var(--font-plex-kr), monospace";
  const names = [...g.tokens.keys()].map((t) => t.slice(2));
  const root = [":root {", "  color-scheme: dark;", ...[...g.tokens].map(([k, v]) => `  ${k}: ${v};`), "}"].join("\n");
  const base = [
    "body {", "  background: var(--canvas);", "  color: var(--body);", `  font-family: ${sans};`, "}", "",
    "code, kbd, samp, pre {", `  font-family: ${mono};`, "}",
  ].join("\n");
  const head = "/* design 스킬 --print-tokens 출력 — guide.md §2에서 뽑았다. 값은 guide.md를 고친 뒤 다시 뽑는다. */";

  if (major === 3) {
    console.log([head, "@tailwind base;", "@tailwind components;", "@tailwind utilities;", "", root, "", base].join("\n"));
    console.log("\n// tailwind.config.ts — theme 바로 아래에 둔다(extend 안이 아니다). 기본 팔레트를 지운다.");
    console.log([
      "colors: {", '  transparent: "transparent",', '  current: "currentColor",',
      ...names.map((n) => `  ${/-/.test(n) ? `"${n}"` : n}: "var(--${n})",`), "},",
      "fontFamily: {",
      `  sans: [${sans.split(", ").map((s) => `"${s}"`).join(", ")}],`,
      `  mono: [${mono.split(", ").map((s) => `"${s}"`).join(", ")}],`, "},",
    ].join("\n"));
    return;
  }

  if (major !== 4) console.error("check_ui: package.json에서 tailwindcss 버전을 못 찾아 v4 형식으로 낸다. v3이면 --tw=3.");
  console.log([
    head, '@import "tailwindcss";', "",
    "@theme {", "  --color-*: initial; /* 기본 팔레트를 지운다 — 토큰 밖의 색은 클래스로도 못 만든다 */", "}", "",
    "@theme inline {", ...names.map((n) => `  --color-${n}: var(--${n});`),
    `  --font-sans: ${sans};`, `  --font-mono: ${mono};`, "}", "",
    root, "", base,
  ].join("\n"));
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

function collect(p, out) {
  if (!existsSync(p)) return;
  if (statSync(p).isDirectory()) {
    if (SKIP_DIRS.has(basename(p))) return;
    for (const e of readdirSync(p)) collect(join(p, e), out);
  } else if (CODE_EXT.has(extname(p)) || extname(p) === ".css") {
    out.push(p);
  }
}

function main() {
  const args = process.argv.slice(2);
  const g = loadGuide();

  if (args.includes("--print-tokens")) {
    printTokens(g, args.find((a) => a.startsWith("--tw="))?.slice(5));
    return;
  }

  const targets = args.filter((a) => !a.startsWith("--"));
  const roots = targets.length
    ? targets.map((t) => (existsSync(resolve(t)) ? resolve(t) : resolve(PROJECT, t)))
    : SCAN_ROOTS.map((r) => join(PROJECT, r));
  const files = [];
  roots.forEach((r) => collect(r, files));

  const found = [];
  const report = (file, line, col, level, id, msg, hit) => found.push({ file, line, col, level, id, msg, hit });

  const rules = buildRules(g);
  files.forEach((f) => scanFile(f, rules, report));
  checkTokens(files, g, report);
  checkFonts(files, report);
  checkDiffFiles(files, report);

  found.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.col - b.col);
  for (const f of found) {
    const where = `${relative(PROJECT, f.file).replaceAll("\\", "/")}:${f.line}:${f.col}`;
    console.log(`${f.level.padEnd(5)}  ${where}  ${f.id}  ${f.msg}  \`${f.hit}\``);
  }

  const errors = found.filter((f) => f.level === "error").length;
  const note = files.length ? `파일 ${files.length}개` : `검사할 파일이 없다 (${targets.length ? targets.join(", ") : "app/, components/"})`;
  console.log(`${found.length ? "\n" : ""}${note} · 오류 ${errors} · 경고 ${found.length - errors}`);
  process.exit(errors ? 1 : 0);
}

main();
