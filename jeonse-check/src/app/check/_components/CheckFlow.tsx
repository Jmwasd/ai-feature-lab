"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/Button";
import { deserializeJudgmentView } from "@/features/judgment/serialize";
import { ResultView } from "@/features/judgment/ui/ResultView";
import type { JudgmentView } from "@/features/judgment/ui/types";
import { LookupForm } from "@/features/lookup-input/LookupForm";
import { type AddressCandidate, type LookupInput, lookupInputSchema } from "@/features/lookup-input/schema";
import { RightsForm, type RightsFormValue } from "@/features/rights-input/RightsForm";
import type { CheckError as CheckErrorCode, RunCheckResult } from "../_actions/run-check";
import type { SearchAddressResult } from "../_actions/search-address";
import { CheckError } from "./CheckError";

// lookup-input·rights-input·judgment feature는 서로 참조하지 않으므로 이 라우트에서 조합한다.
// 서버 호출은 page.tsx가 넘긴 Server Action으로만 한다. 이 파일은 server 레이어를 import하지 않는다.

type CheckPayload = { lookup: LookupInput; rights: RightsFormValue };

type CheckFlowProps = {
  searchAddress: (keyword: string) => Promise<SearchAddressResult>;
  runCheck: (payload: CheckPayload) => Promise<RunCheckResult>;
};

type Step = "lookup" | "rights" | "result";

type RunState = { status: "pending" } | { status: "error"; code: CheckErrorCode } | { status: "done"; view: JudgmentView };

const STEPS: { key: Step; title: string; description: string; heading: string }[] = [
  { key: "lookup", title: "조회 조건", description: "주소·보증금·전용면적", heading: "주소와 보증금을 입력해 주세요" },
  { key: "rights", title: "권리관계", description: "등기부 보고 입력", heading: "등기부 권리관계를 입력해 주세요" },
  { key: "result", title: "결과", description: "위험 신호와 근거", heading: "조회 결과" },
];

export function CheckFlow({ searchAddress, runCheck }: CheckFlowProps) {
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
    const next = await runCheckSafely(runCheck, payload);
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

  return (
    <div className="flex flex-col">
      <div className="mx-auto flex w-full max-w-editorial flex-col gap-xl px-gutter pt-section">
        <StepProgress current={step} />
        <h1 ref={headingRef} tabIndex={-1} className="text-display-xl text-ink outline-none">
          {current.heading}
        </h1>
      </div>

      {step === "lookup" ? (
        <div className="mx-auto w-full max-w-editorial px-gutter py-xl">
          <LookupForm searchAddress={(keyword) => searchCandidates(searchAddress, keyword)} onSubmit={submitLookup} defaultValue={lookup ?? undefined} />
        </div>
      ) : null}

      {step === "rights" ? (
        <div className="mx-auto w-full max-w-editorial px-gutter py-xl">
          <RightsForm asOf={asOf} onSubmit={submitRights} onBack={() => setStep("lookup")} defaultValue={rights ?? undefined} />
        </div>
      ) : null}

      {step === "result" && run.status === "pending" ? <Waiting /> : null}

      {step === "result" && run.status === "error" ? (
        <CheckError code={run.code} onAction={() => handleErrorAction(run.code)} />
      ) : null}

      {step === "result" && run.status === "done" ? (
        <>
          <ResultView view={run.view} />
          <div className="mx-auto flex w-full max-w-editorial justify-center px-gutter pb-section">
            <Button variant="secondary" onClick={restart}>
              조건 바꿔 다시 보기
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}

// 단계 진행 탭(UI_GUIDE §4): 3px 진행 막대 + 제목 + 설명. 현재 단계만 잉크.
function StepProgress({ current }: { current: Step }) {
  const currentIndex = STEPS.findIndex((item) => item.key === current);
  return (
    <ol aria-label="진행 단계" className="grid grid-cols-3 gap-md">
      {STEPS.map((item, i) => {
        const isCurrent = i === currentIndex;
        return (
          <li key={item.key} aria-current={isCurrent ? "step" : undefined} className="flex flex-col gap-sm">
            <span className="relative h-[3px] w-full overflow-hidden rounded-full bg-surface-strong">
              {isCurrent ? <span className="absolute inset-0 bg-ink" /> : null}
            </span>
            <span className={`text-title-md ${isCurrent ? "text-ink" : "text-muted"}`}>
              {i + 1}. {item.title}
            </span>
            <span className="text-body-sm text-muted">{item.description}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Waiting() {
  return (
    <div className="mx-auto w-full max-w-editorial px-gutter py-xl">
      <div role="status" className="flex flex-col gap-sm rounded-card bg-surface-soft p-lg">
        <p className="text-title-md text-ink">실거래가를 모으고 있어요</p>
        <p className="text-body-sm text-body">
          첫 조회라면 이 지역 실거래가를 새로 받아 저장하느라 시간이 오래 걸릴 수 있어요. 창을 닫지 말고 기다려 주세요
        </p>
      </div>
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
async function runCheckSafely(runCheck: CheckFlowProps["runCheck"], payload: CheckPayload): Promise<RunState> {
  try {
    const result = await runCheck(payload);
    if (!result.ok) return { status: "error", code: result.error };
    return { status: "done", view: deserializeJudgmentView(result.view) };
  } catch {
    return { status: "error", code: "lookup-failed" };
  }
}
