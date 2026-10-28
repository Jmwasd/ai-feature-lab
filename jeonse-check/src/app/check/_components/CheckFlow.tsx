"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/Button";
import { Panel } from "@/components/Panel";
import { deserializeJudgmentView } from "@/features/judgment/serialize";
import { ResultView } from "@/features/judgment/ui/ResultView";
import type { JudgmentView } from "@/features/judgment/ui/types";
import { LookupForm } from "@/features/lookup-input/LookupForm";
import { type AddressCandidate, type LookupInput, lookupInputSchema } from "@/features/lookup-input/schema";
import { RightsForm, type RightsFormValue } from "@/features/rights-input/RightsForm";
import { formatWon } from "@/utils/format";
import type { CheckError as CheckErrorCode, RunCheckResult } from "../_actions/run-check";
import type { SaveResultResult } from "../_actions/save-result";
import type { SearchAddressResult } from "../_actions/search-address";
import type { CheckPrefill } from "../_lib/saved-prefill";
import { CheckError } from "./CheckError";
import { SaveResultButton } from "./SaveResultButton";

// lookup-input·rights-input·judgment feature는 서로 참조하지 않으므로 이 라우트에서 조합한다.
// 서버 호출은 page.tsx가 넘긴 Server Action으로만 한다. 이 파일은 server 레이어를 import하지 않는다.

type CheckPayload = { lookup: LookupInput; rights: RightsFormValue };

type CheckFlowProps = {
  searchAddress: (keyword: string) => Promise<SearchAddressResult>;
  runCheck: (payload: CheckPayload) => Promise<RunCheckResult>;
  saveResult: (payload: { token: string }) => Promise<SaveResultResult>;
  // 저장한 결과의 입력(같은 조건으로 다시 조회). 첫 입력에만 쓰고, 사용자가 입력하면 그 값이 우선한다.
  prefill?: CheckPrefill | null;
};

type Step = "lookup" | "rights" | "result";

// runId는 판정 요청마다 달라 결과가 바뀌면 저장 버튼 상태를 새로 시작하게 한다.
type RunState =
  | { status: "pending" }
  | { status: "error"; code: CheckErrorCode }
  | { status: "done"; runId: number; view: JudgmentView; saveToken: string | null };

// 단계별 머리말(Prototype 3D 시안). 진행 막대는 입력 두 단계만 보이고 결과에서는 숨긴다.
const STEPS: { key: Step; bar: string; eyebrow: string; heading: string; lead: string }[] = [
  {
    key: "lookup",
    bar: "STEP 01 · 주소와 보증금",
    eyebrow: "01 — 주소와 보증금",
    heading: "어떤 집을 확인할까요?",
    lead: "주소와 보증금을 알려 주시면 근처 실거래가로 시세를 추정해요.",
  },
  {
    key: "rights",
    bar: "STEP 02 · 등기부 권리",
    eyebrow: "02 — 숨은 위험",
    heading: "등기부를 보고 입력해 주세요",
    lead: "인터넷등기소에서 뗀 등기사항증명서의 갑구와 을구를 보면 돼요.",
  },
  { key: "result", bar: "", eyebrow: "03 — 위험 신호 정리", heading: "조회 결과", lead: "" },
];

export function CheckFlow({ searchAddress, runCheck, saveResult, prefill }: CheckFlowProps) {
  const [step, setStep] = useState<Step>("lookup");
  // 앞 단계로 돌아가도 입력이 남도록 값을 여기에 둔다. URL·localStorage에는 남기지 않는다(개인 정보).
  const [lookup, setLookup] = useState<LookupInput | null>(null);
  const [rights, setRights] = useState<RightsFormValue | null>(null);
  const [run, setRun] = useState<RunState>({ status: "pending" });
  const [asOf] = useState(() => new Date());
  // 조건을 바꿔 다시 조회한 뒤 이전 요청 응답이 늦게 와도 결과를 덮지 않게 한다.
  const latestRun = useRef(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  // 단계가 바뀌면 제목으로 초점을 옮겨 화면 읽기 프로그램이 새 단계를 알 수 있게 한다.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  async function startCheck(payload: CheckPayload) {
    const requestId = ++latestRun.current;
    setRun({ status: "pending" });
    const next = await runCheckSafely(runCheck, payload, requestId);
    if (requestId === latestRun.current) setRun(next);
  }

  function submitLookup(input: LookupInput) {
    setLookup(input);
    setStep("rights");
  }

  function submitRights(value: RightsFormValue) {
    if (!lookup) return;
    setRights(value);
    setStep("result");
    void startCheck({ lookup, rights: value });
  }

  function retry() {
    if (lookup && rights) void startCheck({ lookup, rights });
  }

  function restart() {
    latestRun.current++;
    setStep("lookup");
  }

  // 오류 화면의 행동 버튼. 재시도는 사용자가 누를 때만 한다(한도 초과 때 자동 재시도는 호출을 더 쓴다).
  function handleErrorAction(code: CheckErrorCode) {
    switch (code) {
      case "invalid-input":
        // 서버가 어느 쪽 입력을 거절했는지 알려 주지 않으므로, 조회 조건이 스키마를 통과하면 권리관계로 보낸다.
        latestRun.current++;
        setStep(lookup && lookupInputSchema.safeParse(lookup).success ? "rights" : "lookup");
        return;
      case "address-not-found":
        restart();
        return;
      case "unsupported-house":
        // MVP 밖 유형이므로 입력을 비우고 처음부터 시작한다.
        setLookup(null);
        setRights(null);
        restart();
        return;
      case "quota":
      case "lookup-failed":
        retry();
        return;
      case "unauthorized":
        // CheckError가 로그인 링크를 보여 준다.
        return;
    }
  }

  const current = STEPS.find((item) => item.key === step)!;
  const scanning = step === "result" && run.status === "pending";
  const glow = scanning ? "data" : run.status === "done" && step === "result" && run.view.report.signals.length === 0 ? "data" : "primary";

  return (
    <div className="relative isolate">
      <Backdrop tone={glow} />
      {/* 입력 단계는 시안 폭(720px), 결과는 본문과 같은 editorial 폭에 맞춘다 */}
      <div className={`mx-auto flex w-full flex-col gap-xl px-gutter pt-14 ${step === "result" && !scanning ? "max-w-editorial" : "max-w-[720px]"}`}>
        {step !== "result" ? <StepBar current={step} /> : null}
        {scanning ? (
          <Scanning />
        ) : (
          <header className="flex flex-col gap-md">
            <p className={`font-mono text-eyebrow ${step === "result" ? "text-data-soft" : "text-primary"}`}>{current.eyebrow}</p>
            <h1 ref={headingRef} tabIndex={-1} className="text-chapter text-ink outline-none">
              {current.heading}
            </h1>
            {current.lead ? <p className="text-lead text-body">{current.lead}</p> : null}
          </header>
        )}

        {step === "lookup" ? (
          <div className="pb-section">
            <LookupForm
              searchAddress={(keyword) => searchCandidates(searchAddress, keyword)}
              onSubmit={submitLookup}
              defaultValue={lookup ?? prefill?.lookup}
              defaultKeyword={prefill?.addressKeyword}
            />
          </div>
        ) : null}

        {step === "rights" ? (
          <div className="flex flex-col gap-xl pb-section">
            {lookup ? <LookupSummary lookup={lookup} /> : null}
            <RightsForm asOf={asOf} onSubmit={submitRights} onBack={() => setStep("lookup")} defaultValue={rights ?? prefill?.rights} />
          </div>
        ) : null}
      </div>

      {step === "result" && run.status === "error" ? (
        <CheckError code={run.code} onAction={() => handleErrorAction(run.code)} />
      ) : null}

      {step === "result" && run.status === "done" ? (
        <>
          <ResultView view={run.view} />
          <div className="mx-auto flex w-full max-w-editorial flex-wrap justify-center gap-md px-gutter pb-section">
            <SaveResultButton key={run.runId} token={run.saveToken} saveResult={saveResult} />
            <Button variant="secondary" onClick={restart} className="min-h-13.5">
              조건 바꿔 다시 보기
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}

// 상단 글로우와 옅은 격자. 입력은 레드, 분석 중·위험 신호 0개는 블루다(장식이라 읽지 않는다).
function Backdrop({ tone }: { tone: "primary" | "data" }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[720px] overflow-hidden">
      <div
        className="absolute inset-0 opacity-50"
        style={{
          backgroundImage:
            "linear-gradient(color-mix(in srgb, var(--color-ink) 3.5%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--color-ink) 3.5%, transparent) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse at 50% 30%, var(--color-ink) 20%, transparent 75%)",
        }}
      />
      <div
        className="absolute top-[-360px] left-1/2 size-[720px] -translate-x-1/2 rounded-full opacity-20 transition-[background] duration-500"
        style={{ background: `radial-gradient(circle, var(--color-${tone}) 0%, transparent 65%)` }}
      />
    </div>
  );
}

// 입력 단계 진행 막대(UI_GUIDE §4 단계 진행 탭). 지난 단계와 현재 단계를 채운다.
function StepBar({ current }: { current: Step }) {
  const inputs = STEPS.filter((item) => item.key !== "result");
  const currentIndex = inputs.findIndex((item) => item.key === current);
  return (
    <ol aria-label="진행 단계" className="grid grid-cols-2 gap-md">
      {inputs.map((item, i) => (
        <li key={item.key} aria-current={i === currentIndex ? "step" : undefined} className="flex flex-col gap-2.5">
          <span className="h-0.5 overflow-hidden rounded-full bg-ink/10">
            <span className={`block h-full bg-primary transition-[width] duration-500 ease-rise ${i <= currentIndex ? "w-full" : "w-0"}`} />
          </span>
          <span className={`font-mono text-badge tracking-wider ${i <= currentIndex ? "text-ink" : "text-muted"}`}>{item.bar}</span>
        </li>
      ))}
    </ol>
  );
}

// 권리관계 단계 위의 조회 조건 요약(시안의 요약 카드 3개 자리).
function LookupSummary({ lookup }: { lookup: LookupInput }) {
  const items = [
    { label: "주소", value: lookup.address.roadAddress },
    { label: "보증금", value: formatWon(lookup.deposit) },
    { label: "전용면적", value: `${lookup.exclusiveArea}㎡` },
  ];
  return (
    <dl className="grid grid-cols-1 gap-sm tablet:grid-cols-[2fr_1fr_1fr]">
      {items.map((item) => (
        <div key={item.label} className="flex min-w-0 flex-col gap-1 rounded-md border border-hairline bg-ink/5 p-base">
          <dt className="font-mono text-badge tracking-wider text-data-soft">{item.label}</dt>
          <dd className="truncate font-mono text-title-md tabular-nums text-ink">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

// 조회 대기(시안 SCANNING). 서버가 단계별 진행을 알려 주지 않으므로 출처 줄을 시간에 맞춰 넘기고,
// 마지막 줄은 응답이 올 때까지 돈다. 진행률은 응답 전까지 100%를 채우지 않는다.
const SCAN_LINES = [
  { text: "실거래가 조회 · 해제 거래 제외", org: "국토교통부" },
  { text: "공동주택 공시가격 확인", org: "한국부동산원" },
  { text: "건축물대장 용도 확인", org: "세움터" },
] as const;
const SCAN_STEP_MS = 1400;

function Scanning() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (active >= SCAN_LINES.length - 1) return;
    const timer = setTimeout(() => setActive((i) => i + 1), SCAN_STEP_MS);
    return () => clearTimeout(timer);
  }, [active]);

  const percent = Math.round((active / SCAN_LINES.length) * 100);

  return (
    <div className="flex flex-col gap-xl pb-section">
      <header className="flex flex-col gap-md">
        <p className="font-mono text-eyebrow text-data">SCANNING — 공공데이터 분석</p>
        <h1 className="text-chapter text-ink">
          공공데이터로
          <br />
          집을 스캔하고 있어요
        </h1>
      </header>
      <Panel tone="data" className="flex flex-col gap-md">
        <div className="flex items-baseline justify-between">
          <span className="text-body-sm text-body">분석 진행</span>
          <span className="font-mono text-display-sm font-bold tabular-nums text-ink">{percent}%</span>
        </div>
        <div className="h-0.75 overflow-hidden rounded-full bg-ink/10">
          <div className="h-full rounded-full bg-data transition-[width] duration-500" style={{ width: `${percent}%` }} />
        </div>
        <ul className="flex flex-col">
          {SCAN_LINES.map((line, i) => (
            <li
              key={line.text}
              className={`flex items-center gap-md border-t border-hairline-soft py-md transition-opacity duration-300 ${i <= active ? "opacity-100" : "opacity-35"}`}
            >
              <span
                aria-hidden="true"
                className={`size-4 flex-none rounded-full border-2 ${i < active ? "border-data bg-data/30" : i === active ? "animate-spin border-data border-t-transparent" : "border-data/50"}`}
              />
              <span className="flex-1 text-body-sm text-ink">{line.text}</span>
              <span className="font-mono text-badge font-regular text-muted">{line.org}</span>
            </li>
          ))}
        </ul>
        <p role="status" className="text-caption-sm text-muted">
          첫 조회라면 이 지역 실거래가를 새로 받아 저장하느라 시간이 오래 걸릴 수 있어요. 창을 닫지 말고 기다려 주세요
        </p>
      </Panel>
    </div>
  );
}

// LookupForm은 후보 목록을 받거나 예외를 기대한다. 오류 코드는 예외로 바꿔 폼의 검색 오류 안내를 쓰게 한다.
async function searchCandidates(
  searchAddress: CheckFlowProps["searchAddress"],
  keyword: string,
): Promise<AddressCandidate[]> {
  const result = await searchAddress(keyword);
  if (!result.ok) throw new Error(result.error);
  return result.candidates;
}

// 오류 코드는 그대로 넘긴다. 호출 예외(네트워크 등)와 읽을 수 없는 결과는 원인을 보이지 않고 lookup-failed('다시 시도')로 둔다.
async function runCheckSafely(
  runCheck: CheckFlowProps["runCheck"],
  payload: CheckPayload,
  runId: number,
): Promise<RunState> {
  try {
    const result = await runCheck(payload);
    if (!result.ok) return { status: "error", code: result.error };
    return { status: "done", runId, view: deserializeJudgmentView(result.view), saveToken: result.saveToken };
  } catch {
    return { status: "error", code: "lookup-failed" };
  }
}
