"use client";

import { Search } from "lucide-react";
import { useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Button } from "@/components/Button";
import { SearchBarPill } from "@/components/SearchBarPill";
import { TextInput } from "@/components/TextInput";
import { formatWon } from "@/utils/format";
import { parseWonInput } from "@/utils/parse-won-input";
import { HOUSE_TYPE_LABEL, HOUSE_TYPES, lookupInputSchema, type AddressCandidate, type HouseType, type LookupInput } from "./schema";

type LookupFormProps = {
  // 주소 검색은 호출만 한다. 서비스키가 필요한 실제 API 호출은 서버 쪽 함수가 맡는다.
  searchAddress: (keyword: string) => Promise<AddressCandidate[]>;
  onSubmit: (input: LookupInput) => void;
  defaultValue?: Partial<LookupInput>;
};

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; results: AddressCandidate[] }
  | { status: "error" };

type FieldErrors = Partial<Record<keyof LookupInput, string>>;

const UNIT_NOTICE = "동·호를 입력하면 공시가격으로 HUG 기준을 계산해요";

// 조회 조건 입력 폼. 모바일은 세로 입력 스택 + 하단 고정 CTA, desktop은 SearchBarPill + 오브(UI_GUIDE §3·§4).
export function LookupForm({ searchAddress, onSubmit, defaultValue }: LookupFormProps) {
  const [keyword, setKeyword] = useState(defaultValue?.address?.roadAddress ?? "");
  const [selected, setSelected] = useState<AddressCandidate | null>(defaultValue?.address ?? null);
  const [search, setSearch] = useState<SearchState>({ status: "idle" });
  const [houseType, setHouseType] = useState<HouseType | null>(defaultValue?.houseType ?? null);
  const [depositText, setDepositText] = useState(depositToText(defaultValue?.deposit));
  const [areaText, setAreaText] = useState(defaultValue?.exclusiveArea?.toString() ?? "");
  const [dong, setDong] = useState(defaultValue?.dong ?? "");
  const [ho, setHo] = useState(defaultValue?.ho ?? "");
  const [errors, setErrors] = useState<FieldErrors>({});
  // 늦게 도착한 이전 검색 응답이 최신 결과를 덮지 않게 한다.
  const latestSearch = useRef(0);
  const houseTypeLabelId = useId();
  const houseTypeErrorId = useId();

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

  const parsedDeposit = parseWonInput(depositText);
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

      <SearchBarPill
        orb={
          <button
            type="submit"
            aria-label="조회하기"
            className="flex size-control items-center justify-center rounded-full bg-primary text-on-primary transition-colors active:bg-primary-active"
          >
            <Search aria-hidden="true" className="size-5" />
          </button>
        }
      >
        <TextInput
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
        <TextInput
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
          className="tabular-nums"
        />
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
          className="tabular-nums"
        />
      </SearchBarPill>

      <AddressResults state={search} onSelect={selectCandidate} />

      <div className="flex flex-col gap-sm desktop:mt-lg">
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
      </div>

      <div
        data-testid="mobile-cta"
        className="fixed inset-x-0 bottom-0 z-10 border-t border-hairline bg-canvas px-gutter py-sm tablet:static tablet:border-0 tablet:bg-transparent tablet:p-0 desktop:hidden"
      >
        <Button type="submit" className="w-full tablet:w-auto">
          조회하기
        </Button>
      </div>
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

// 원 단위 금액을 입력창 문자열로 되돌린다. 만원 단위로 떨어지지 않으면 원 단위 그대로 쓴다.
function depositToText(deposit: number | undefined): string {
  if (deposit === undefined) return "";
  return deposit > 0 && deposit % 10_000 === 0 ? formatWon(deposit) : `${deposit}원`;
}

// 전용면적 입력(㎡). 숫자와 소수점만 받고, 그 밖은 NaN으로 두어 스키마가 오류를 내게 한다.
function parseAreaInput(text: string): number {
  const trimmed = text.trim();
  return /^\d+(\.\d+)?$/.test(trimmed) ? Number(trimmed) : Number.NaN;
}
