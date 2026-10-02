"use client";

import { ArrowRight, Search } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Button } from "@/components/Button";
import { Reveal } from "@/components/Reveal";
import { SearchBarPill } from "@/components/SearchBarPill";
import { TextInput } from "@/components/TextInput";
import { formatWon } from "@/utils/format";
import { parseWonInput, wonToInputText } from "@/utils/parse-won-input";
import { HOUSE_TYPE_LABEL, HOUSE_TYPES, lookupInputSchema, type AddressCandidate, type HouseType, type LookupInput } from "./schema";

type LookupFormProps = {
  // 주소 검색은 호출만 한다. 서비스키가 필요한 실제 API 호출은 서버 쪽 함수가 맡는다.
  searchAddress: (keyword: string) => Promise<AddressCandidate[]>;
  onSubmit: (input: LookupInput) => void;
  defaultValue?: Partial<LookupInput>;
  // 주소 후보 없이 검색어만 채울 때 쓴다(저장한 결과로 다시 조회). 사용자가 검색해서 다시 골라야 제출된다.
  defaultKeyword?: string;
};

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; results: AddressCandidate[] }
  | { status: "error" };

type FieldErrors = Partial<Record<keyof LookupInput, string>>;

const UNIT_NOTICE = "동·호를 입력하면 공시가격으로 HUG 기준을 계산해요";

// 칸이 나타나는 순서. 앞 칸이 유효해야 다음 칸이 열린다. 마지막(units)은 선택 입력인 동·호와 다음 버튼이다.
const STAGES = ["houseType", "address", "deposit", "exclusiveArea", "units"] as const;
type Stage = (typeof STAGES)[number];
const ALL_STAGES = STAGES.length - 1;

// 칸을 벗어날 때 바로 확인하는 필드. 스키마 문구를 그대로 쓴다.
const BLUR_CHECK = {
  deposit: (text: string) => lookupInputSchema.shape.deposit.safeParse(parseWonInput(text) ?? Number.NaN),
  exclusiveArea: (text: string) => lookupInputSchema.shape.exclusiveArea.safeParse(parseAreaInput(text)),
} as const;

// 조회 조건 입력 폼. 모바일은 세로 입력 스택 + 하단 고정 CTA, desktop은 SearchBarPill + 오브(UI_GUIDE §3·§4).
export function LookupForm({ searchAddress, onSubmit, defaultValue, defaultKeyword }: LookupFormProps) {
  const [keyword, setKeyword] = useState(defaultValue?.address?.roadAddress ?? defaultKeyword ?? "");
  const [selected, setSelected] = useState<AddressCandidate | null>(defaultValue?.address ?? null);
  const [search, setSearch] = useState<SearchState>({ status: "idle" });
  const [houseType, setHouseType] = useState<HouseType | null>(defaultValue?.houseType ?? null);
  const [depositText, setDepositText] = useState(defaultValue?.deposit === undefined ? "" : wonToInputText(defaultValue.deposit));
  const [areaText, setAreaText] = useState(defaultValue?.exclusiveArea?.toString() ?? "");
  const [dong, setDong] = useState(defaultValue?.dong ?? "");
  const [ho, setHo] = useState(defaultValue?.ho ?? "");
  const [errors, setErrors] = useState<FieldErrors>({});
  // 늦게 도착한 이전 검색 응답이 최신 결과를 덮지 않게 한다.
  const latestSearch = useRef(0);
  const houseTypeLabelId = useId();
  const houseTypeErrorId = useId();
  const addressRef = useRef<HTMLInputElement>(null);
  const depositRef = useRef<HTMLInputElement>(null);
  // 고르는 동작(주택 유형·주소 후보)으로 새 칸이 열리면 그 칸으로 포커스를 옮긴다. 타이핑 중에는 옮기지 않는다.
  const pendingFocus = useRef<"address" | "deposit" | null>(null);

  // 미리 채운 값이 있으면(다시 조회·조건 바꿔 다시 보기) 처음부터 모든 칸을 보인다.
  const [initialStage] = useState(() => (hasAnyValue(defaultValue, defaultKeyword) ? ALL_STAGES : 0));
  const parsedDeposit = parseWonInput(depositText);
  const reachable = countValid([
    houseType !== null,
    selected !== null,
    parsedDeposit !== null && parsedDeposit > 0,
    parseAreaInput(areaText) > 0,
  ]);
  // 한 번 열린 칸은 앞 칸을 고쳐도 닫지 않는다(입력이 사라지지 않게). 다음 버튼은 지금 값이 모두 유효할 때만 보인다.
  const [openedStage, setOpenedStage] = useState(initialStage);
  if (reachable > openedStage) setOpenedStage(reachable);
  const visibleStage = Math.max(openedStage, reachable);
  const complete = reachable === ALL_STAGES;
  const isOpen = (stage: Stage) => STAGES.indexOf(stage) <= visibleStage;
  const appears = (stage: Stage) => STAGES.indexOf(stage) > initialStage;

  useEffect(() => {
    const target = pendingFocus.current === "address" ? addressRef.current : pendingFocus.current === "deposit" ? depositRef.current : null;
    if (!target) return;
    pendingFocus.current = null;
    target.focus();
  });

  const clearError = (field: keyof LookupInput) => setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));

  async function runSearch() {
    const trimmed = keyword.trim();
    if (trimmed === "") {
      setErrors((prev) => ({ ...prev, address: "검색할 주소를 입력해 주세요" }));
      return;
    }
    const requestId = ++latestSearch.current;
    setSearch({ status: "loading" });
    try {
      const results = await searchAddress(trimmed);
      if (requestId === latestSearch.current) setSearch({ status: "done", results });
    } catch {
      if (requestId === latestSearch.current) setSearch({ status: "error" });
    }
  }

  function onAddressKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // 한글 조합 중의 Enter는 조합 확정이므로 검색하지 않는다.
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    event.preventDefault();
    void runSearch();
  }

  function selectCandidate(candidate: AddressCandidate) {
    if (!isOpen("deposit")) pendingFocus.current = "deposit";
    latestSearch.current++;
    setSelected(candidate);
    setKeyword(candidate.roadAddress);
    setSearch({ status: "idle" });
    clearError("address");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = lookupInputSchema.safeParse({
      address: selected ?? undefined,
      houseType: houseType ?? undefined,
      deposit: parseWonInput(depositText) ?? Number.NaN,
      exclusiveArea: parseAreaInput(areaText),
      dong,
      ho,
    });
    if (!result.success) {
      const next: FieldErrors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof LookupInput;
        next[field] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    onSubmit(result.data);
  }

  function checkOnBlur(field: keyof typeof BLUR_CHECK, text: string) {
    if (text.trim() === "") return;
    const result = BLUR_CHECK[field](text);
    if (!result.success) setErrors((prev) => ({ ...prev, [field]: result.error.issues[0]?.message }));
  }

  const depositHint = parsedDeposit !== null && parsedDeposit > 0 ? `${formatWon(parsedDeposit)} 원` : undefined;

  return (
    <form noValidate aria-label="조회 조건" onSubmit={handleSubmit} className="flex flex-col gap-lg pb-section tablet:pb-0">
      <div className="flex flex-col gap-sm">
        <span id={houseTypeLabelId} className="text-caption text-muted">
          주택 유형
        </span>
        <div
          role="radiogroup"
          aria-labelledby={houseTypeLabelId}
          aria-describedby={errors.houseType ? houseTypeErrorId : undefined}
          className="flex gap-sm overflow-x-auto"
        >
          {HOUSE_TYPES.map((type) => (
            <label
              key={type}
              className="inline-flex h-11 shrink-0 cursor-pointer items-center rounded-full border border-hairline bg-canvas px-lg text-button-sm text-ink transition-colors hover:bg-surface-soft has-checked:border-ink has-checked:bg-ink has-checked:text-canvas has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink"
            >
              <input
                type="radio"
                name="houseType"
                value={type}
                checked={houseType === type}
                onChange={() => {
                  if (!isOpen("address")) pendingFocus.current = "address";
                  setHouseType(type);
                  clearError("houseType");
                }}
                className="sr-only"
              />
              {HOUSE_TYPE_LABEL[type]}
            </label>
          ))}
        </div>
        {errors.houseType ? (
          <p id={houseTypeErrorId} className="px-xs text-caption-sm text-error-text">
            {errors.houseType}
          </p>
        ) : null}
      </div>

      {isOpen("address") ? (
        <SearchBarPill
          orb={
            complete ? (
              <Reveal appear>
                <button
                  type="submit"
                  aria-label="다음"
                  className="flex size-control items-center justify-center rounded-full bg-primary text-on-primary transition-colors active:bg-primary-active"
                >
                  <ArrowRight aria-hidden="true" className="size-5" />
                </button>
              </Reveal>
            ) : undefined
          }
        >
          <Reveal appear={appears("address")} className={SEGMENT_REVEAL}>
            <TextInput
              ref={addressRef}
              segment
              label="주소"
              placeholder="도로명 또는 지번 주소"
              autoComplete="off"
              value={keyword}
              error={errors.address}
              onChange={(event) => {
                setKeyword(event.target.value);
                setSelected(null);
                clearError("address");
              }}
              onKeyDown={onAddressKeyDown}
              trailing={
                <button
                  type="button"
                  aria-label="주소 검색"
                  onClick={() => void runSearch()}
                  className="inline-flex h-xl items-center gap-xs rounded-full border border-hairline bg-canvas px-md text-button-sm text-ink transition-colors hover:bg-surface-soft"
                >
                  <Search aria-hidden="true" className="size-4" />
                  검색
                </button>
              }
            />
          </Reveal>
          {isOpen("deposit") ? (
            <Reveal appear={appears("deposit")} className={SEGMENT_REVEAL}>
              <TextInput
                ref={depositRef}
                segment
                label="보증금"
                placeholder="2억 8000만"
                value={depositText}
                error={errors.deposit}
                hint={depositHint}
                onChange={(event) => {
                  setDepositText(event.target.value);
                  clearError("deposit");
                }}
                onBlur={(event) => checkOnBlur("deposit", event.target.value)}
                className="tabular-nums"
              />
            </Reveal>
          ) : null}
          {isOpen("exclusiveArea") ? (
            <Reveal appear={appears("exclusiveArea")} className={SEGMENT_REVEAL}>
              <TextInput
                segment
                label="전용면적(㎡)"
                placeholder="59.8"
                inputMode="decimal"
                value={areaText}
                error={errors.exclusiveArea}
                onChange={(event) => {
                  setAreaText(event.target.value);
                  clearError("exclusiveArea");
                }}
                onBlur={(event) => checkOnBlur("exclusiveArea", event.target.value)}
                className="tabular-nums"
              />
            </Reveal>
          ) : null}
        </SearchBarPill>
      ) : null}

      <AddressResults state={search} onSelect={selectCandidate} />

      {isOpen("units") ? (
        <Reveal appear={appears("units")} className="flex flex-col gap-sm desktop:mt-lg">
          <div className="grid grid-cols-2 gap-md">
            <TextInput
              label="동"
              placeholder="101동"
              value={dong}
              error={errors.dong}
              onChange={(event) => {
                setDong(event.target.value);
                clearError("dong");
              }}
            />
            <TextInput
              label="호"
              placeholder="203호"
              value={ho}
              error={errors.ho}
              onChange={(event) => {
                setHo(event.target.value);
                clearError("ho");
              }}
            />
          </div>
          {dong.trim() === "" || ho.trim() === "" ? <p className="px-xs text-body-sm text-muted">{UNIT_NOTICE}</p> : null}
        </Reveal>
      ) : null}

      {complete ? (
        <div
          data-testid="mobile-cta"
          className="fixed inset-x-0 bottom-0 z-10 border-t border-hairline bg-canvas px-gutter py-sm tablet:static tablet:border-0 tablet:bg-transparent tablet:p-0 desktop:hidden"
        >
          <Reveal appear>
            <Button type="submit" className="w-full tablet:w-auto">
              다음
            </Button>
          </Reveal>
        </div>
      ) : null}
    </form>
  );
}

function AddressResults({ state, onSelect }: { state: SearchState; onSelect: (candidate: AddressCandidate) => void }) {
  const results = state.status === "done" ? state.results : [];

  return (
    <div className="flex flex-col gap-sm desktop:mt-lg">
      <p role="status" className="px-xs text-body-sm empty:hidden">
        {state.status === "loading" ? <span className="text-muted">주소를 찾고 있어요</span> : null}
        {state.status === "done" && results.length === 0 ? (
          <span className="text-muted">검색 결과가 없어요. 도로명이나 지번을 다시 확인해 주세요</span>
        ) : null}
        {state.status === "error" ? (
          <span className="text-error-text">주소를 불러오지 못했어요. 잠시 뒤 다시 검색해 주세요</span>
        ) : null}
      </p>
      {results.length > 0 ? (
        <ul aria-label="주소 검색 결과" className="overflow-hidden rounded-card border border-hairline bg-canvas">
          {results.map((candidate) => (
            <li key={candidate.id} className="border-t border-hairline-soft first:border-t-0">
              <button
                type="button"
                onClick={() => onSelect(candidate)}
                className="flex w-full flex-col items-start gap-xxs px-base py-md text-left transition-colors hover:bg-surface-soft"
              >
                <span className="text-body-md text-ink">{candidate.roadAddress}</span>
                <span className="text-body-sm text-muted">{candidate.jibunAddress}</span>
                {candidate.buildingName ? <span className="text-caption text-body">{candidate.buildingName}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// SearchBarPill 세그먼트 자리를 그대로 차지하도록 TextInput segment의 desktop 배치를 감싸는 쪽에도 준다.
const SEGMENT_REVEAL = "flex min-w-0 flex-col desktop:h-full desktop:flex-1";

function countValid(steps: boolean[]): number {
  const firstInvalid = steps.indexOf(false);
  return firstInvalid === -1 ? steps.length : firstInvalid;
}

function hasAnyValue(defaultValue: Partial<LookupInput> | undefined, defaultKeyword: string | undefined): boolean {
  return (defaultKeyword ?? "") !== "" || Object.values(defaultValue ?? {}).some((value) => value !== undefined);
}

// 전용면적 입력(㎡). 숫자와 소수점만 받고, 그 밖은 NaN으로 두어 스키마가 오류를 내게 한다.
function parseAreaInput(text: string): number {
  const trimmed = text.trim();
  return /^\d+(\.\d+)?$/.test(trimmed) ? Number(trimmed) : Number.NaN;
}
