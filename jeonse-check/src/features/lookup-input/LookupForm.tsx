"use client";

import { Search } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Button } from "@/components/Button";
import { Panel } from "@/components/Panel";
import { Reveal } from "@/components/Reveal";
import { TextInput } from "@/components/TextInput";
import { useProgressiveStages } from "@/hooks/use-progressive-stages";
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

// 칸을 벗어날 때 바로 확인하는 필드. 스키마 문구를 그대로 쓴다.
const BLUR_CHECK = {
  deposit: (text: string) => lookupInputSchema.shape.deposit.safeParse(parseWonInput(text) ?? Number.NaN),
  exclusiveArea: (text: string) => lookupInputSchema.shape.exclusiveArea.safeParse(parseAreaInput(text)),
} as const;

// 조회 조건 입력 폼. 입력 칸을 Panel 하나에 쌓고, 모두 유효하면 아래 오른쪽에 "다음"을 보인다(Prototype 3D 시안).
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

  const parsedDeposit = parseWonInput(depositText);
  const { complete, isOpen, appears } = useProgressiveStages(
    STAGES,
    [
      houseType !== null,
      selected !== null,
      parsedDeposit !== null && parsedDeposit > 0,
      parseAreaInput(areaText) > 0,
    ],
    // 미리 채운 값이 있으면(다시 조회·조건 바꿔 다시 보기) 처음부터 모든 칸을 보인다.
    hasAnyValue(defaultValue, defaultKeyword),
  );

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
    <form noValidate aria-label="조회 조건" onSubmit={handleSubmit} className="flex flex-col gap-xl">
      <Panel className="flex flex-col gap-lg">
        <div className="flex flex-col gap-sm">
          <span id={houseTypeLabelId} className={FIELD_LABEL}>
            주택 유형
          </span>
          <div
            role="radiogroup"
            aria-labelledby={houseTypeLabelId}
            aria-describedby={errors.houseType ? houseTypeErrorId : undefined}
            className="flex gap-sm overflow-x-auto"
          >
            {HOUSE_TYPES.map((type) => (
              <label key={type} className={CHOICE_PILL}>
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
            <p id={houseTypeErrorId} className="text-caption-sm text-error-text">
              {errors.houseType}
            </p>
          ) : null}
        </div>

        {isOpen("address") ? (
          <Reveal appear={appears("address")} className="flex flex-col gap-sm">
            <TextInput
              ref={addressRef}
              label="주소"
              placeholder="도로명, 지번, 건물명으로 검색"
              autoComplete="off"
              value={keyword}
              error={errors.address}
              hint={selected ? <SelectedAddress candidate={selected} /> : undefined}
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
                  className="inline-flex h-xl items-center gap-xs rounded-full border border-hairline bg-ink/5 px-md text-button-sm text-ink transition-colors hover:bg-ink/10"
                >
                  <Search aria-hidden="true" className="size-4" />
                  검색
                </button>
              }
            />
            <AddressResults state={search} onSelect={selectCandidate} />
          </Reveal>
        ) : null}

        {isOpen("deposit") ? (
          <div className="grid gap-base tablet:grid-cols-2">
            <Reveal appear={appears("deposit")}>
              <TextInput
                ref={depositRef}
                label="보증금"
                placeholder="2억 8000만"
                value={depositText}
                error={errors.deposit}
                hint={depositHint ?? "2억 8천만 원이면 2억 8000만"}
                onChange={(event) => {
                  setDepositText(event.target.value);
                  clearError("deposit");
                }}
                onBlur={(event) => checkOnBlur("deposit", event.target.value)}
                className="font-mono tabular-nums"
              />
            </Reveal>
            {isOpen("exclusiveArea") ? (
              <Reveal appear={appears("exclusiveArea")}>
                <TextInput
                  label="전용면적(㎡)"
                  placeholder="59.8"
                  inputMode="decimal"
                  value={areaText}
                  error={errors.exclusiveArea}
                  hint="건축물대장 또는 계약서의 전용면적"
                  onChange={(event) => {
                    setAreaText(event.target.value);
                    clearError("exclusiveArea");
                  }}
                  onBlur={(event) => checkOnBlur("exclusiveArea", event.target.value)}
                  className="font-mono tabular-nums"
                />
              </Reveal>
            ) : null}
          </div>
        ) : null}

        {isOpen("units") ? (
          <Reveal appear={appears("units")} className="flex flex-col gap-sm border-t border-hairline-soft pt-lg">
            <div className="grid grid-cols-2 gap-base">
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
            {dong.trim() === "" || ho.trim() === "" ? <p className="text-caption-sm text-muted">{UNIT_NOTICE}</p> : null}
          </Reveal>
        ) : null}
      </Panel>

      {complete ? (
        <Reveal appear className="flex justify-end">
          <Button type="submit" className="min-h-13.5 px-8">
            다음
          </Button>
        </Reveal>
      ) : null}
    </form>
  );
}

function SelectedAddress({ candidate }: { candidate: AddressCandidate }) {
  return (
    <span className="flex items-center gap-sm text-data-soft">
      <span aria-hidden="true" className="size-1.5 rounded-full bg-data" />
      {[candidate.jibunAddress, candidate.buildingName].filter(Boolean).join(" · ")}
    </span>
  );
}

function AddressResults({ state, onSelect }: { state: SearchState; onSelect: (candidate: AddressCandidate) => void }) {
  const results = state.status === "done" ? state.results : [];

  return (
    <div className="flex flex-col gap-sm empty:hidden">
      <p role="status" className="text-caption-sm empty:hidden">
        {state.status === "loading" ? <span className="text-muted">주소를 찾고 있어요</span> : null}
        {state.status === "done" && results.length === 0 ? (
          <span className="text-muted">일치하는 주소가 없어요. 동 이름이나 건물명으로 검색해 보세요</span>
        ) : null}
        {state.status === "error" ? (
          <span className="text-error-text">주소를 불러오지 못했어요. 잠시 뒤 다시 검색해 주세요</span>
        ) : null}
      </p>
      {results.length > 0 ? (
        <ul aria-label="주소 검색 결과" className="overflow-hidden rounded-md border border-hairline bg-canvas shadow-float">
          {results.map((candidate) => (
            <li key={candidate.id} className="border-t border-hairline-soft first:border-t-0">
              <button
                type="button"
                onClick={() => onSelect(candidate)}
                className="flex w-full items-center gap-md px-base py-md text-left transition-colors hover:bg-ink/5"
              >
                <span aria-hidden="true" className="size-2 flex-none rounded-full bg-data" />
                <span className="flex min-w-0 flex-col gap-xxs">
                  <span className="text-body-sm font-semibold text-ink">{candidate.roadAddress}</span>
                  <span className="text-caption-sm text-muted">
                    {[candidate.jibunAddress, candidate.buildingName].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

const FIELD_LABEL = "font-mono text-badge tracking-wider text-data-soft";

// 선택 탭(UI_GUIDE §4): 선택된 알약만 잉크 바탕.
const CHOICE_PILL =
  "inline-flex h-11 shrink-0 cursor-pointer items-center rounded-full border border-hairline bg-ink/5 px-lg text-button-sm text-ink transition-colors hover:bg-ink/10 has-checked:border-ink has-checked:bg-ink has-checked:text-canvas has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink";

function hasAnyValue(defaultValue: Partial<LookupInput> | undefined, defaultKeyword: string | undefined): boolean {
  return (defaultKeyword ?? "") !== "" || Object.values(defaultValue ?? {}).some((value) => value !== undefined);
}

// 전용면적 입력(㎡). 숫자와 소수점만 받고, 그 밖은 NaN으로 두어 스키마가 오류를 내게 한다.
function parseAreaInput(text: string): number {
  const trimmed = text.trim();
  return /^\d+(\.\d+)?$/.test(trimmed) ? Number(trimmed) : Number.NaN;
}
