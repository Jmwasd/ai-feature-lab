"use client";

import { TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/Button";
import { JEONSE_RATIO_THRESHOLD } from "@/consts/policy";
import { ratioStatusText } from "@/features/judgment/copy";
import { jeonseRatio, type RatioLevel } from "@/features/judgment/ratios";
import { formatWholePercent, formatWon } from "@/utils/format";
import { DATA_CARDS, RISK_MARKERS, SCAN_SOURCES, type DataCard } from "./landing-data";
import { DEMO_DEPOSIT, DEMO_HOUSE, demoMetrics } from "./landing-demo";
import type { LandingScene } from "./landing-scene";
import { CHAPTER_COUNT, CHAPTER_HEIGHTS, chapterOpacity, sectionHeight, dataAppear, progressFromScroll, riskAppear, stageLift, storyFactors } from "./landing-timeline";

// 3D를 띄울 수 없으면(WebGL 없음, 동작 줄이기) 글 장면만 스크롤에 맞춰 바꾼다.
type Mode = "loading" | "3d" | "flat";

const LEVEL_TEXT: Record<RatioLevel, string> = { normal: "text-body", caution: "text-ink", danger: "text-error-text" };

// 글 레이어 공통 위치. 왼쪽 아래에 두고, 좁은 폭에서는 거터만 남긴다.
const TEXT_LEFT = "absolute left-[clamp(20px,6vw,96px)] bottom-[clamp(40px,11vh,130px)]";
const EYEBROW = "font-mono text-eyebrow uppercase";
const CARD = "grid gap-md rounded-card border border-hairline bg-surface-soft/70 p-base";

function supportsWebGL(): boolean {
  if (typeof WebGLRenderingContext === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function countText(card: DataCard, progress: number): string {
  const v = card.to * progress;
  if (card.kind === "won") return formatWon(Math.round(v / 1_000_000) * 1_000_000);
  if (card.kind === "ratio") return formatWholePercent(v);
  return `${Math.round(v)}곳 조회`;
}

// nav는 GNB, notice는 GNB 아래에 띄울 안내(로그인 필요 등)다. 둘 다 고정 무대 안에 둔다.
export function LandingStory({ nav, notice }: { nav?: ReactNode; notice?: ReactNode }) {
  const [deposit, setDeposit] = useState<number>(DEMO_DEPOSIT.initial);
  const [openRisk, setOpenRisk] = useState(-1);
  const [mode, setMode] = useState<Mode>("loading");
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  // 애니메이션 루프가 최신 보증금을 읽도록 ref로 건넨다.
  const depositRef = useRef(deposit);
  const metrics = demoMetrics(deposit);

  useEffect(() => {
    depositRef.current = deposit;
  }, [deposit]);

  useEffect(() => {
    const root = rootRef.current;
    const stage = stageRef.current;
    const canvasHost = canvasRef.current;
    const backdrop = backdropRef.current;
    if (!root || !stage || !canvasHost || !backdrop) return;
    const q = <E extends HTMLElement>(sel: string) => [...root.querySelectorAll<E>(sel)];
    const el = {
      sections: q("[data-sec]"),
      texts: q("[data-txt]"),
      risks: q("[data-anchor='risk']"),
      datas: q("[data-anchor='data']"),
      gauge: root.querySelector<HTMLElement>("[data-anchor='gauge']"),
      gaugeNum: root.querySelector<HTMLElement>("[data-gauge-num]"),
      gaugeState: root.querySelector<HTMLElement>("[data-gauge-state]"),
      counts: q("[data-count]"),
      scanPct: root.querySelector<HTMLElement>("[data-scan-pct]"),
      scanBar: root.querySelector<HTMLElement>("[data-scan-bar]"),
      sources: q("[data-src]"),
      riskCount: root.querySelector<HTMLElement>("[data-risk-count]"),
      progress: root.querySelector<HTMLElement>("[data-progress]"),
    };
    const setText = (node: HTMLElement | null, text: string) => {
      if (node && node.textContent !== text) node.textContent = text;
    };

    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    let scene: LandingScene | null = null;
    let disposed = false;
    let tops: number[] = [];
    let storyEnd = Infinity;
    const measure = () => {
      tops = el.sections.map((s) => s.getBoundingClientRect().top + window.scrollY);
      storyEnd = root.getBoundingClientRect().bottom + window.scrollY;
    };
    measure();

    const pointer = { x: 0, y: 0 };
    const drag = { on: false, x: 0 };
    // 모바일 주소창이 나타나고 숨을 때의 작은 높이 변화는 무시한다. 캔버스를 다시 잡으면 한 프레임이 비어 깜빡인다.
    let size = { w: window.innerWidth, h: window.innerHeight };
    const onResize = () => {
      measure();
      const { innerWidth: w, innerHeight: h } = window;
      if (w === size.w && Math.abs(h - size.h) < 160) return;
      size = { w, h };
      scene?.resize(w, h);
    };
    const onMove = (e: PointerEvent) => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
      if (drag.on && scene) {
        scene.drag(e.clientX - drag.x);
        drag.x = e.clientX;
      }
    };
    // 마우스로 빈 곳을 끌면 집을 돌린다. 터치는 스크롤에 양보한다.
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      if ((e.target as HTMLElement).closest("a,button,input,[data-ui]")) return;
      drag.on = true;
      drag.x = e.clientX;
      stage.style.cursor = "grabbing";
    };
    const onUp = () => {
      drag.on = false;
      stage.style.cursor = "";
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("pointermove", onMove, { passive: true });
    stage.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);

    let smoothF = 0;
    const t0 = performance.now();
    let last = t0;
    let raf = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (document.hidden) return;
      // 고정 무대는 스크롤을 따라가지 않으므로, 푸터가 올라온 만큼 직접 올린다.
      // 올리지 않을 때는 transform을 비워 무대 안 로그인 모달(fixed)이 화면 기준으로 자리 잡게 한다.
      const liftPx = stageLift(storyEnd, window.scrollY, window.innerHeight);
      const lift = liftPx > 0 ? `translate3d(0,${-liftPx}px,0)` : "";
      if (stage.style.transform !== lift) stage.style.transform = backdrop.style.transform = lift;
      const t = (now - t0) / 1000;
      const target = progressFromScroll(tops, window.scrollY);
      smoothF = reducedMotion ? target : smoothF + (target - smoothF) * (1 - Math.exp(-dt * 6));
      const F = smoothF;
      const fx = storyFactors(F);

      el.texts.forEach((node) => {
        const i = Number(node.dataset.txt);
        const o = chapterOpacity(i, F);
        node.style.opacity = o.toFixed(3);
        node.style.transform = reducedMotion ? "" : `translateY(${(-(F - i) * 48).toFixed(1)}px)`;
        node.style.visibility = o < 0.02 ? "hidden" : "visible";
      });
      if (el.progress) {
        el.progress.style.transform = `scaleX(${(F / (CHAPTER_COUNT - 1)).toFixed(4)})`;
        el.progress.style.background = `color-mix(in srgb, var(--color-primary) ${Math.round((1 - fx.calm) * 100)}%, var(--color-data))`;
      }
      setText(el.riskCount, String(RISK_MARKERS.filter((_, i) => riskAppear(i, Math.min(F, 2)) > 0.5).length));
      const sp = fx.scanProgress;
      setText(el.scanPct, formatWholePercent(sp));
      if (el.scanBar) el.scanBar.style.width = `${(sp * 100).toFixed(1)}%`;
      el.sources.forEach((node) => {
        node.style.opacity = sp >= (Number(node.dataset.src) + 1) / 3.3 ? "1" : "0.35";
      });
      el.counts.forEach((node) => setText(node, countText(DATA_CARDS[Number(node.dataset.count)], sp)));

      // 장면이 끝나 뒤 콘텐츠가 화면을 모두 덮으면 그리지 않는다.
      if (!scene || window.scrollY >= storyEnd) return;
      scene.render({ F, fx, t, dt, jeonseRatio: depositRef.current / DEMO_HOUSE.marketPrice, pointer, dragging: drag.on });
      const place = (node: HTMLElement, x: number, y: number, o: number) => {
        node.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
        node.style.opacity = o.toFixed(3);
        node.style.visibility = o < 0.02 ? "hidden" : "visible";
      };
      const houseDistance = scene.houseDistance;
      el.risks.forEach((node, i) => {
        const p = scene!.project("risk", i);
        let o = p.visible ? riskAppear(i, F) : 0;
        if (p.distance > houseDistance + 0.5) o *= 0.35;
        node.style.zIndex = p.distance > houseDistance ? "1" : "2";
        place(node, p.x, p.y, o);
      });
      el.datas.forEach((node, j) => {
        const p = scene!.project("data", j);
        place(node, p.x, p.y, p.visible ? dataAppear(j, F) : 0);
      });
      if (el.gauge) {
        const p = scene.project("gauge");
        place(el.gauge, p.x, p.y, p.visible ? fx.result * (1 - fx.fin) : 0);
      }
      const gauge = jeonseRatio(scene.gaugeRatio * DEMO_HOUSE.marketPrice, DEMO_HOUSE.marketPrice);
      if (gauge) {
        setText(el.gaugeNum, formatWholePercent(gauge.ratio));
        setText(el.gaugeState, `전세가율 · ${ratioStatusText(gauge, JEONSE_RATIO_THRESHOLD)}`);
        if (el.gaugeState) el.gaugeState.className = `text-caption whitespace-nowrap ${LEVEL_TEXT[gauge.level]}`;
      }
    };
    raf = requestAnimationFrame(loop);

    const boot = async () => {
      if (reducedMotion || !supportsWebGL()) return setMode("flat");
      try {
        const [T, { LandingScene }, post] = await Promise.all([
          import("three"),
          import("./landing-scene"),
          Promise.all([
            import("three/addons/postprocessing/EffectComposer.js"),
            import("three/addons/postprocessing/RenderPass.js"),
            import("three/addons/postprocessing/UnrealBloomPass.js"),
            import("three/addons/postprocessing/OutputPass.js"),
          ])
            .then(([a, b, c, d]) => ({ EffectComposer: a.EffectComposer, RenderPass: b.RenderPass, UnrealBloomPass: c.UnrealBloomPass, OutputPass: d.OutputPass }))
            .catch(() => null),
        ]);
        if (disposed) return;
        scene = new LandingScene(T, post, canvasHost, depositRef.current / DEMO_HOUSE.marketPrice);
        setMode("3d");
      } catch (error) {
        console.error(error);
        if (!disposed) setMode("flat");
      }
    };
    void boot();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onMove);
      stage.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      scene?.dispose();
    };
  }, []);

  const scrollToChapter = (i: number) => {
    const section = rootRef.current?.querySelectorAll<HTMLElement>("[data-sec]")[i];
    if (section) window.scrollTo({ top: section.getBoundingClientRect().top + window.scrollY + 2, behavior: "smooth" });
  };

  return (
    <>
      {/* 캔버스와 무대(글·GNB)는 모두 화면에 고정한다. 장면이 끝나면 안내·푸터가 올라온 만큼 둘을 transform으로 함께 올린다.
          sticky 무대가 고정↔스크롤로 바뀌는 순간 Chrome이 레이어를 다시 짜며 WebGL 캔버스가 한두 프레임 빠져 검게 깜빡였다. */}
      <div ref={backdropRef} aria-hidden="true" className="fixed inset-x-0 top-0 -z-10 h-lvh will-change-transform">
        <div
          ref={canvasRef}
          className="absolute inset-0"
          style={{ background: "radial-gradient(ellipse at 50% 40%, var(--color-surface-strong) 0%, var(--color-canvas) 70%)" }}
        />
        {/* 가장자리를 어둡게 눌러 글을 읽기 쉽게 한다 */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 50% 42%, transparent 52%, color-mix(in srgb, var(--color-canvas) 62%, transparent) 100%), linear-gradient(to top, color-mix(in srgb, var(--color-canvas) 78%, transparent) 0%, transparent 42%)",
          }}
        />
      </div>

      <div ref={rootRef} className="relative select-none">
        <div ref={stageRef} className="fixed inset-x-0 top-0 h-svh overflow-hidden">

          {/* 3D 표식 위에 붙는 글. 좌표는 매 프레임 장면에서 투영해 옮긴다. 좁은 폭에서는 데이터 카드·게이지를 숨긴다 */}
          <div className={`pointer-events-none absolute inset-0 overflow-hidden ${mode === "3d" ? "" : "hidden"}`}>
            {RISK_MARKERS.map((risk, i) => (
              <div key={risk.name} data-anchor="risk" className="invisible absolute top-0 left-0 opacity-0 will-change-transform">
                <button
                  type="button"
                  data-ui
                  aria-expanded={openRisk === i}
                  onClick={() => setOpenRisk((open) => (open === i ? -1 : i))}
                  className="pointer-events-auto flex -translate-x-[15px] -translate-y-[15px] items-start gap-2.5 text-left"
                >
                  <span className="grid size-7.5 flex-none place-items-center rounded-full border-2 border-primary bg-primary/20 font-mono text-caption-sm font-bold text-ink">
                    {i + 1}
                  </span>
                  <span className="grid gap-1.5 rounded-md border border-primary/30 bg-canvas/70 px-md py-1.5">
                    <span className="whitespace-nowrap text-body-sm font-semibold text-ink">{risk.name}</span>
                    {openRisk === i ? <span className="block w-55 text-caption-sm leading-normal text-body">{risk.desc}</span> : null}
                  </span>
                </button>
              </div>
            ))}
            {DATA_CARDS.map((card, j) => (
              <div key={card.key} data-anchor="data" className="invisible absolute top-0 left-0 opacity-0 will-change-transform max-tablet:hidden">
                <div
                  className={`flex items-center ${card.side === "l" ? "flex-row-reverse -translate-x-[calc(100%-4px)]" : "-translate-x-1"} -translate-y-1/2`}
                >
                  <span className="size-2 flex-none rounded-full bg-data" />
                  <span className="h-px w-8.5 flex-none bg-data/60" />
                  <span className="grid gap-0.5 whitespace-nowrap rounded-md border border-data/30 bg-canvas/70 px-md py-sm">
                    <span className="font-mono text-badge tracking-wider text-data-soft">{card.key}</span>
                    <span data-count={j} className="font-mono text-display-sm font-bold tabular-nums text-ink">
                      {countText(card, 0)}
                    </span>
                    <span className="text-badge font-regular text-muted">{card.sub}</span>
                  </span>
                </div>
              </div>
            ))}
            <div data-anchor="gauge" className="invisible absolute top-0 left-0 opacity-0 max-tablet:hidden">
              <div className="grid -translate-x-1/2 -translate-y-1/2 justify-items-center gap-1.5 text-center">
                <span data-gauge-num className="font-mono text-ratio-display tabular-nums text-ink">
                  {formatWholePercent(DEMO_DEPOSIT.initial / DEMO_HOUSE.marketPrice)}
                </span>
                <span data-gauge-state className="whitespace-nowrap text-caption text-body" />
              </div>
            </div>
          </div>

          {/* 00 첫 장면 */}
          <div data-txt="0" className={`${TEXT_LEFT} pointer-events-none grid max-w-[min(860px,calc(100vw-40px))] gap-lg`}>
            <p className={`${EYEBROW} flex items-center gap-md text-primary`}>
              <span aria-hidden="true" className="h-px w-7 bg-primary" />
              Jeonse Check · 전세 위험 진단
            </p>
            <h1 className="text-hero text-ink">
              전세, <span className="text-primary">감으로</span>
              <br />
              결정하지 마세요.
            </h1>
            <p className="max-w-130 text-lead text-body">평생 모은 보증금이 걸린 계약이에요. 서명하기 전에 이 집에 숨은 위험 신호부터 확인하세요.</p>
            <p className="flex flex-wrap gap-lg font-mono text-caption-sm text-muted">
              <span className="flex items-center gap-sm">
                <span aria-hidden="true" className="h-4.5 w-px bg-muted" />
                스크롤해서 들여다보기
              </span>
              {mode === "3d" ? (
                <span className="hidden items-center gap-sm desktop:flex">
                  <span aria-hidden="true" className="h-px w-4.5 bg-muted" />
                  드래그해서 돌려 보기
                </span>
              ) : null}
            </p>
          </div>

          {/* 01 숨은 위험 */}
          <div data-txt="1" className={`${TEXT_LEFT} pointer-events-none grid w-[min(460px,calc(100vw-40px))] gap-lg opacity-0`}>
            <p className={`${EYEBROW} text-primary`}>01 — 숨은 위험</p>
            <h2 className="text-chapter text-ink">
              겉으로는
              <br />
              멀쩡해 보여도
            </h2>
            <p className="text-lead text-body">
              등기부 한 장, 건축물대장 한 줄에 위험이 숨어 있어요.{mode === "3d" ? " 집 주변에 떠오른 신호를 눌러 보세요." : ""}
            </p>
            <div className="flex items-center gap-md justify-self-start rounded-card border border-primary/25 bg-canvas/60 px-base py-md">
              <span className="font-mono text-ratio-display text-primary">
                <span data-risk-count>0</span>
                <span className="text-display-sm text-muted"> / {RISK_MARKERS.length}</span>
              </span>
              <span className="text-body-sm text-body">
                예시로 찾은
                <br />
                위험 신호
              </span>
            </div>
            {mode === "flat" ? (
              <ul className="grid gap-xs">
                {RISK_MARKERS.map((risk) => (
                  <li key={risk.name} className="flex items-center gap-sm text-body-sm text-body">
                    <TriangleAlert aria-hidden="true" size={16} className="text-error-text" />
                    {risk.name}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {/* 02 공공데이터 분석 */}
          <div
            data-txt="2"
            className="pointer-events-none absolute right-[clamp(20px,7vw,120px)] bottom-[clamp(40px,11vh,130px)] grid w-[min(420px,calc(100vw-40px))] gap-lg opacity-0"
          >
            <p className={`${EYEBROW} text-data`}>02 — 공공데이터 분석</p>
            <h2 className="text-chapter text-ink">
              공공데이터로
              <br />
              집을 스캔해요
            </h2>
            <p className="text-lead text-body">실거래가, 공시가격, 건축물대장을 불러와 보증금을 돌려받기 어려워질 신호가 있는지 계산해요.</p>
            <div className={`${CARD} border-data/25`}>
              <div className="flex items-baseline justify-between gap-md">
                <span className="text-body-sm text-body">분석 진행</span>
                <span data-scan-pct className="font-mono text-display-sm font-bold tabular-nums text-ink">
                  0%
                </span>
              </div>
              <div className="h-0.75 overflow-hidden rounded-full bg-surface-strong">
                <div data-scan-bar className="h-full w-0 rounded-full bg-data" />
              </div>
              <ul className="grid gap-2.5">
                {SCAN_SOURCES.map((source, i) => (
                  <li key={source.name} data-src={i} className="flex items-center gap-2.5 text-body-sm text-ink opacity-35 transition-opacity duration-300">
                    <span aria-hidden="true" className="grid size-4 flex-none place-items-center rounded-full border-2 border-data">
                      <span className="size-1.5 rounded-full bg-data" />
                    </span>
                    <span className="flex-1">{source.name}</span>
                    <span className="font-mono text-badge font-regular text-muted">{source.org}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* 03 위험 신호 정리 */}
          <div
            data-txt="3"
            className="pointer-events-none absolute left-[clamp(20px,6vw,96px)] bottom-[clamp(32px,9vh,110px)] grid w-[min(460px,calc(100vw-40px))] gap-lg opacity-0"
          >
            <p className={`${EYEBROW} text-data-soft`}>03 — 위험 신호 정리</p>
            <h2 className="text-chapter text-ink">
              흩어진 위험을
              <br />
              한눈에 정리해요
            </h2>
            <p className="text-lead text-body">전세가율, 부채비율, HUG 보증 가입 기준으로 위험 신호를 세어요. 보증금을 바꿔 보세요.</p>
            <div data-ui className={`${CARD} pointer-events-auto`}>
              <div className="flex items-baseline justify-between gap-md">
                <label htmlFor="landing-deposit" className="text-body-sm text-body">
                  보증금
                </label>
                <span className="font-mono text-display-sm font-bold tabular-nums text-ink">{formatWon(deposit)}</span>
              </div>
              <input
                id="landing-deposit"
                type="range"
                aria-label="보증금"
                min={DEMO_DEPOSIT.min}
                max={DEMO_DEPOSIT.max}
                step={DEMO_DEPOSIT.step}
                value={deposit}
                onChange={(e) => setDeposit(Number(e.target.value))}
              />
              <p className="text-caption-sm text-muted">
                예시 집 · 추정 시세 {formatWon(DEMO_HOUSE.marketPrice)} · 근저당 {formatWon(DEMO_HOUSE.maxClaimAmount)} · 공시가격{" "}
                {formatWon(DEMO_HOUSE.officialPrice)}
              </p>
              <ul className="grid grid-cols-3 gap-sm">
                {metrics.map((m) => (
                  <li key={m.label} className="grid min-w-0 gap-1 rounded-md border border-hairline bg-ink/5 p-md">
                    <span className="text-caption-sm text-muted">{m.label}</span>
                    <span className={`font-mono text-display-sm font-bold tabular-nums ${LEVEL_TEXT[m.level]}`}>{m.value}</span>
                    <span className={`text-badge ${LEVEL_TEXT[m.level]}`}>{m.status}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* 04 계약 전 확인 */}
          <div
            data-txt="4"
            className="pointer-events-none absolute inset-x-0 bottom-[clamp(36px,9vh,110px)] mx-auto grid w-[min(760px,calc(100vw-40px))] justify-items-center gap-lg text-center opacity-0"
          >
            <p className={`${EYEBROW} text-data-soft`}>04 — 계약 전 확인</p>
            <h2 className="text-chapter text-ink">
              3분이면, 서명 전에
              <br />
              위험 신호를 알 수 있어요.
            </h2>
            <p className="max-w-130 text-lead text-body">주소와 보증금만 넣으면 돼요. 공공데이터로 계산해 계약 전에 결과를 알려 드려요.</p>
            <div className="pointer-events-auto flex flex-wrap justify-center gap-md">
              <Button href="/check" className="min-h-13.5 px-7">
                지금 위험도 확인하기
              </Button>
              <Button variant="secondary" onClick={() => scrollToChapter(2)} className="min-h-13.5">
                어떻게 계산하나요
              </Button>
            </div>
          </div>

          {/* 장면 진행 막대 */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 z-20 h-0.5">
            <div data-progress className="h-full w-full origin-left scale-x-0 bg-primary" />
          </div>

          {nav}
          {notice ? <div className="absolute inset-x-0 top-nav z-10">{notice}</div> : null}

          {mode === "loading" ? (
            <div aria-hidden="true" className="absolute inset-0 z-30 grid place-items-center bg-canvas">
              <div className="grid justify-items-center gap-base">
                <p className="font-mono text-eyebrow tracking-[0.32em] text-muted">JEONSE CHECK</p>
                <div className="h-px w-40 overflow-hidden bg-hairline">
                  <div className="h-full w-2/5 animate-pulse bg-primary" />
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* 스크롤 길이를 만드는 빈 섹션. 고정 무대 뒤에 있다 */}
        <div aria-hidden="true">
          {CHAPTER_HEIGHTS.map((_, i) => (
            <div key={i} data-sec={i} style={{ height: `${sectionHeight(i)}svh` }} />
          ))}
        </div>
      </div>
    </>
  );
}
