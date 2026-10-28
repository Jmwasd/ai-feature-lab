"use client";

import { Plus, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { z } from "zod";
import { Button } from "@/components/Button";
import { IconButtonCircle } from "@/components/IconButtonCircle";
import { Panel } from "@/components/Panel";
import { Reveal } from "@/components/Reveal";
import { TextInput } from "@/components/TextInput";
import { useProgressiveStages } from "@/hooks/use-progressive-stages";
import { formatIsoDate, formatWon } from "@/utils/format";
import { parseWonInput, wonToInputText } from "@/utils/parse-won-input";
import { rightsInputSchema, validateRightsInput } from "./schema";

// judgment의 RightsInput과 구조가 같다(테스트에서 검사). feature 간 참조 금지라 그 타입을 import하지 않는다.
export type RightsFormValue = z.infer<typeof rightsInputSchema>;

type RightsFormProps = {
  onSubmit: (rights: RightsFormValue) => void;
  onBack?: () => void;
  asOf: Date; // 미래 날짜 판단 기준. 호출하는 쪽이 오늘을 넘긴다
  defaultValue?: Partial<RightsFormValue>;
};

// 근저당은 "있음"(건별 입력) / "없음"(0원)을 명시적으로 고른다. null은 아직 고르지 않은 상태다.
type MortgageMode = "some" | "none" | null;
type MortgageEntry = { id: number; text: string };
type FieldErrors = Partial<Record<keyof RightsFormValue, string>>;

const NOTICE = "입력한 등기부 내용으로만 판단해요. 계약 당일 등기부를 다시 확인하세요";

// 등기부에서 볼 곳. 등기부 목차 이름(갑구·을구)을 그대로 쓴다.
const HELP = {
  mortgage: "을구 → 근저당권설정 → 채권최고액. 말소된 건은 빼고 건마다 입력해요",
  seniorDeposits: "을구 → 전세권설정·임차권등기 → 전세금·임차보증금. 없으면 0을 입력해요",
  trust: "갑구 → 소유권이전 등기의 목적에 '신탁'이 있는지 봐요",
  ownership: "갑구 → 마지막 소유권이전 → 접수일. 보존등기만 있으면 '소유권 이전 없음'을 골라요",
} as const;

const MORTGAGE_UNSET_ERROR = "근저당이 있는지 골라 주세요";
const AMOUNT_PARSE_ERROR = "금액을 이해하지 못했어요. 예: 1억 2000만, 5000만";
const MORTGAGE_ZERO_ERROR = "0원인 건은 지우거나 '근저당 없음'을 골라 주세요";

// 칸이 나타나는 순서. 앞 칸이 유효해야 다음 칸이 열리고, 모두 유효하면 확인 버튼이 나타난다.
const STAGES = ["mortgage", "seniorDeposits", "trust", "ownership", "submit"] as const;

// 예/아니오 선택(UI_GUIDE §4). 알약이고 선택된 쪽만 잉크 바탕이다.
const CHOICE =
  "inline-flex h-11 cursor-pointer items-center justify-center rounded-full border bg-ink/5 px-6 text-button-sm font-semibold text-ink transition-colors hover:bg-ink/10 has-checked:border-ink has-checked:bg-ink has-checked:text-canvas has-disabled:cursor-not-allowed has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink";

// 등기부 권리관계 입력 폼. 입력하지 않은 값은 0·false·null로 채우지 않고 오류로 둔다.
export function RightsForm({ onSubmit, onBack, asOf, defaultValue }: RightsFormProps) {
  const [mortgageMode, setMortgageMode] = useState<MortgageMode>(initialMortgageMode(defaultValue?.maxClaimAmount));
  const nextEntryId = useRef(1);
  const [entries, setEntries] = useState<MortgageEntry[]>(() => [
    { id: 0, text: defaultValue?.maxClaimAmount ? wonToInputText(defaultValue.maxClaimAmount) : "" },
  ]);
  const [entryErrors, setEntryErrors] = useState<Record<number, string>>({});
  const [seniorText, setSeniorText] = useState(
    defaultValue?.seniorDeposits === undefined ? "" : wonToInputText(defaultValue.seniorDeposits),
  );
  const [isTrust, setIsTrust] = useState<boolean | null>(defaultValue?.isTrust ?? null);
  const [dateText, setDateText] = useState(defaultValue?.lastOwnershipChangeDate ? formatIsoDate(defaultValue.lastOwnershipChangeDate) : "");
  const [noOwnershipChange, setNoOwnershipChange] = useState(defaultValue?.lastOwnershipChangeDate === null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const firstEntryRef = useRef<HTMLInputElement>(null);
  const seniorRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  // 고르는 동작으로 새 칸이 열리면 그 칸의 입력으로 포커스를 옮긴다. 타이핑 중에는 옮기지 않는다.
  const pendingFocus = useRef<"firstEntry" | "seniorDeposits" | "ownership" | null>(null);

  const seniorAmount = parseWonInput(seniorText);
  const { complete, isOpen, appears } = useProgressiveStages(
    STAGES,
    [
      mortgageMode === "none" || (mortgageMode === "some" && entries.every((entry) => (parseWonInput(entry.text) ?? 0) > 0)),
      seniorText.trim() !== "" && seniorAmount !== null,
      isTrust !== null,
      ownershipError(noOwnershipChange, dateText, asOf) === null,
    ],
    // 미리 채운 값이 있으면(다시 조회) 처음부터 모든 칸을 보인다.
    Object.values(defaultValue ?? {}).some((value) => value !== undefined),
  );

  useEffect(() => {
    const targets = { firstEntry: firstEntryRef, seniorDeposits: seniorRef, ownership: dateRef };
    const target = pendingFocus.current ? targets[pendingFocus.current].current : null;
    if (!target) return;
    pendingFocus.current = null;
    target.focus();
  });

  const clearError = (field: keyof RightsFormValue) => setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));

  function updateEntry(id: number, text: string) {
    setEntries((prev) => prev.map((entry) => (entry.id === id ? { ...entry, text } : entry)));
    setEntryErrors((prev) => (prev[id] ? { ...prev, [id]: "" } : prev));
    clearError("maxClaimAmount");
  }

  function addEntry() {
    setEntries((prev) => [...prev, { id: nextEntryId.current++, text: "" }]);
  }

  function removeEntry(id: number) {
    setEntries((prev) => prev.filter((entry) => entry.id !== id));
  }

  function chooseMortgage(mode: Exclude<MortgageMode, null>) {
    if (mode === "some" && mortgageMode !== "some") pendingFocus.current = "firstEntry";
    else if (mode === "none" && !isOpen("seniorDeposits")) pendingFocus.current = "seniorDeposits";
    setMortgageMode(mode);
    setEntryErrors({});
    clearError("maxClaimAmount");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextEntryErrors = mortgageMode === "some" ? entryErrorsOf(entries) : {};
    const entriesValid = Object.keys(nextEntryErrors).length === 0;
    const seniorDeposits = seniorText.trim() === "" ? undefined : (parseWonInput(seniorText) ?? Number.NaN);

    const result = validateRightsInput(
      {
        maxClaimAmount: mortgageTotal(mortgageMode, entries, entriesValid),
        seniorDeposits,
        isTrust: isTrust ?? undefined,
        lastOwnershipChangeDate: noOwnershipChange ? null : optionalDate(dateText),
      },
      asOf,
    );

    if (!result.success || !entriesValid) {
      setErrors(fieldErrorsOf(result.error?.issues ?? [], mortgageMode, entriesValid, seniorDeposits));
      setEntryErrors(nextEntryErrors);
      return;
    }
    setErrors({});
    setEntryErrors({});
    onSubmit(result.data);
  }

  // 칸을 벗어날 때 읽을 수 없는 금액을 바로 알린다. 비어 있으면 아직 입력 중으로 본다.
  function checkEntryOnBlur(id: number, text: string) {
    if (text.trim() === "") return;
    const message = entryAmountError(text);
    if (message) setEntryErrors((prev) => ({ ...prev, [id]: message }));
  }

  return (
    <form noValidate aria-label="권리관계 입력" onSubmit={handleSubmit} className="flex flex-col gap-xl">
      <p className="flex flex-wrap items-center gap-sm text-caption-sm text-muted">
        <span className="font-mono text-badge tracking-wider text-data-soft">사용자 입력(등기부 기준)</span>
        {NOTICE}
      </p>

      <Panel className="flex flex-col">
        <Field title="근저당" help={HELP.mortgage}>
          {(titleId, helpId) => (
            <>
              <ChoiceGroup
                name="mortgage"
                labelledBy={titleId}
                helpId={helpId}
                error={errors.maxClaimAmount}
                value={mortgageMode}
                options={[
                  { value: "some", label: "근저당 있음" },
                  { value: "none", label: "근저당 없음" },
                ]}
                onChange={chooseMortgage}
              />
              {mortgageMode === "some" ? (
                <div className="flex flex-col gap-md">
                  {entries.map((entry, index) => {
                    const amount = parseWonInput(entry.text);
                    return (
                      <TextInput
                        key={entry.id}
                        ref={index === 0 ? firstEntryRef : undefined}
                        label={`근저당 ${index + 1} 채권최고액`}
                        placeholder="1억 2000만"
                        value={entry.text}
                        error={entryErrors[entry.id] || undefined}
                        hint={amount !== null && amount > 0 ? wonText(amount) : undefined}
                        onChange={(event) => updateEntry(entry.id, event.target.value)}
                        onBlur={(event) => checkEntryOnBlur(entry.id, event.target.value)}
                        className="font-mono tabular-nums"
                        trailing={
                          entries.length > 1 ? (
                            <IconButtonCircle label={`근저당 ${index + 1} 삭제`} icon={<X className="size-4" />} onClick={() => removeEntry(entry.id)} />
                          ) : undefined
                        }
                      />
                    );
                  })}
                  <div className="flex flex-wrap items-center justify-between gap-md">
                    <button
                      type="button"
                      onClick={addEntry}
                      className="inline-flex h-xl items-center gap-xs rounded-full border border-hairline bg-ink/5 px-md text-button-sm text-ink transition-colors hover:bg-ink/10"
                    >
                      <Plus aria-hidden="true" className="size-4" />
                      근저당 추가
                    </button>
                    <p aria-live="polite" className="font-mono text-title-md text-ink tabular-nums">
                      합계 {wonText(sumEntries(entries))}
                    </p>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </Field>

        {isOpen("seniorDeposits") ? (
          <Field title="선순위 임차보증금" help={HELP.seniorDeposits} appear={appears("seniorDeposits")}>
            {() => (
              <TextInput
                ref={seniorRef}
                label="선순위 임차보증금 합계"
                placeholder="0"
                value={seniorText}
                error={errors.seniorDeposits}
                hint={seniorAmount !== null ? wonText(seniorAmount) : undefined}
                onChange={(event) => {
                  setSeniorText(event.target.value);
                  clearError("seniorDeposits");
                }}
                onBlur={(event) => {
                  if (event.target.value.trim() !== "" && parseWonInput(event.target.value) === null) {
                    setErrors((prev) => ({ ...prev, seniorDeposits: AMOUNT_PARSE_ERROR }));
                  }
                }}
                className="tabular-nums"
              />
            )}
          </Field>
        ) : null}

        {isOpen("trust") ? (
          <Field title="신탁 등기" help={HELP.trust} appear={appears("trust")}>
            {(titleId, helpId) => (
              <ChoiceGroup
                name="isTrust"
                labelledBy={titleId}
                helpId={helpId}
                error={errors.isTrust}
                value={isTrust === null ? null : isTrust ? "yes" : "no"}
                options={[
                  { value: "yes", label: "예" },
                  { value: "no", label: "아니오" },
                ]}
                onChange={(value) => {
                  if (!isOpen("ownership")) pendingFocus.current = "ownership";
                  setIsTrust(value === "yes");
                  clearError("isTrust");
                }}
              />
            )}
          </Field>
        ) : null}

        {isOpen("ownership") ? (
          <Field title="최근 소유권 이전" help={HELP.ownership} appear={appears("ownership")}>
            {() => (
              <div className="flex flex-col gap-sm">
                <TextInput
                  ref={dateRef}
                  type="date"
                  label="최근 소유권 이전 등기일"
                  max={localIsoDate(asOf)}
                  value={noOwnershipChange ? "" : dateText}
                  disabled={noOwnershipChange}
                  error={errors.lastOwnershipChangeDate}
                  onChange={(event) => {
                    setDateText(event.target.value);
                    clearError("lastOwnershipChangeDate");
                  }}
                  onBlur={(event) => {
                    if (event.target.value === "") return;
                    const message = ownershipError(false, event.target.value, asOf);
                    if (message) setErrors((prev) => ({ ...prev, lastOwnershipChangeDate: message }));
                  }}
                  className="tabular-nums"
                />
                <label className={`${CHOICE} self-start border-hairline`}>
                  <input
                    type="checkbox"
                    checked={noOwnershipChange}
                    onChange={(event) => {
                      setNoOwnershipChange(event.target.checked);
                      clearError("lastOwnershipChangeDate");
                    }}
                    className="sr-only"
                  />
                  소유권 이전 없음(보존등기만 있음)
                </label>
              </div>
            )}
          </Field>
        ) : null}
      </Panel>

      <div className="flex items-center justify-between gap-md">
        {onBack ? (
          <Button variant="ghost" onClick={onBack} className="min-h-13.5">
            이전
          </Button>
        ) : (
          <span />
        )}
        {complete ? (
          <Reveal appear>
            <Button type="submit" className="min-h-13.5 px-8">
              위험 신호 확인하기
            </Button>
          </Reveal>
        ) : null}
      </div>
    </form>
  );
}

// 항목 제목 + 등기부 위치 도움말 + 입력. 섹션 사이는 hairline-soft로 나눈다.
type FieldProps = {
  title: string;
  help: string;
  // 앞 칸을 채워 새로 나타날 때 true. 처음부터 있던 칸은 등장 전환을 주지 않는다.
  appear?: boolean;
  children: (titleId: string, helpId: string) => ReactNode;
};

function Field({ title, help, appear = false, children }: FieldProps) {
  const titleId = useId();
  const helpId = useId();
  return (
    <Reveal appear={appear} className="flex flex-col gap-md border-t border-hairline-soft py-lg first:border-t-0 first:pt-0 last:pb-0">
      <div className="flex flex-col gap-xs">
        <h3 id={titleId} className="text-title-md text-ink">
          {title}
        </h3>
        <p id={helpId} className="text-caption-sm text-muted">
          {help}
        </p>
      </div>
      {children(titleId, helpId)}
    </Reveal>
  );
}

type ChoiceGroupProps<T extends string> = {
  name: string;
  labelledBy: string;
  helpId: string;
  error?: string;
  value: T | null;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
};

function ChoiceGroup<T extends string>({ name, labelledBy, helpId, error, value, options, onChange }: ChoiceGroupProps<T>) {
  const errorId = useId();
  return (
    <div className="flex flex-col gap-xs">
      <div
        role="radiogroup"
        aria-labelledby={labelledBy}
        aria-describedby={error ? `${helpId} ${errorId}` : helpId}
        aria-invalid={error ? true : undefined}
        className="flex flex-wrap gap-sm"
      >
        {options.map((option) => (
          <label key={option.value} className={`${CHOICE} ${error ? "border-error-text" : "border-hairline"}`}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
      {error ? (
        <p id={errorId} className="text-caption-sm text-error-text">
          {error}
        </p>
      ) : null}
    </div>
  );
}

// 소유권 이전 칸의 오류 문구. 유효하면 null이다. 날짜 판단은 제출 검증(validateRightsInput)과 같은 기준을 쓴다.
function ownershipError(noOwnershipChange: boolean, dateText: string, asOf: Date): string | null {
  if (noOwnershipChange) return null;
  const result = validateRightsInput(
    { maxClaimAmount: 0, seniorDeposits: 0, isTrust: false, lastOwnershipChangeDate: optionalDate(dateText) },
    asOf,
  );
  return result.success ? null : (result.error.issues[0]?.message ?? null);
}

function initialMortgageMode(maxClaimAmount: number | undefined): MortgageMode {
  if (maxClaimAmount === undefined) return null;
  return maxClaimAmount === 0 ? "none" : "some";
}

// 읽을 수 있는 건만 더한다. 제출 전에는 건별 검증을 따로 한다.
function sumEntries(entries: MortgageEntry[]): number {
  return entries.reduce((sum, entry) => sum + (parseWonInput(entry.text) ?? 0), 0);
}

// 근저당 한 건의 금액 오류 문구. 유효하면 null이다.
function entryAmountError(text: string): string | null {
  const amount = parseWonInput(text);
  return amount === null ? AMOUNT_PARSE_ERROR : amount === 0 ? MORTGAGE_ZERO_ERROR : null;
}

function entryErrorsOf(entries: MortgageEntry[]): Record<number, string> {
  return Object.fromEntries(
    entries.flatMap((entry) => {
      const message = entryAmountError(entry.text);
      return message ? [[entry.id, message]] : [];
    }),
  );
}

// 제출할 채권최고액. 고르지 않았거나 건별 오류가 있으면 undefined로 두어 스키마가 오류를 낸다.
function mortgageTotal(mode: MortgageMode, entries: MortgageEntry[], entriesValid: boolean): number | undefined {
  if (mode === "none") return 0;
  return mode === "some" && entriesValid ? sumEntries(entries) : undefined;
}

function fieldErrorsOf(
  issues: readonly { path: readonly PropertyKey[]; message: string }[],
  mortgageMode: MortgageMode,
  entriesValid: boolean,
  seniorDeposits: number | undefined,
): FieldErrors {
  // 필드마다 첫 번째 문구만 보인다.
  const firstIssues = issues.filter((issue, i) => issues.findIndex((other) => other.path[0] === issue.path[0]) === i);
  const schemaErrors: FieldErrors = Object.fromEntries(firstIssues.map((issue) => [issue.path[0], issue.message]));
  return {
    ...schemaErrors,
    // 근저당은 건별 오류가 따로 보이므로, 그룹 오류는 고르지 않았을 때와 합계 자체의 오류만 둔다.
    maxClaimAmount: mortgageMode === null ? MORTGAGE_UNSET_ERROR : entriesValid ? schemaErrors.maxClaimAmount : undefined,
    seniorDeposits: Number.isNaN(seniorDeposits) ? AMOUNT_PARSE_ERROR : schemaErrors.seniorDeposits,
  };
}

function wonText(amount: number): string {
  return amount === 0 ? "0원" : `${formatWon(amount)} 원`;
}

// <input type="date">의 "YYYY-MM-DD"를 UTC 자정 Date로 읽는다(formatIsoDate와 같은 기준). 형식이 다르면 Invalid Date.
function parseDateInput(text: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? new Date(`${text}T00:00:00Z`) : new Date(Number.NaN);
}

// 비어 있으면 아직 입력하지 않은 값(undefined)이다.
function optionalDate(text: string): Date | undefined {
  return text === "" ? undefined : parseDateInput(text);
}

// 사용자가 보는 로컬 날짜의 "YYYY-MM-DD". 날짜 입력의 max로 쓴다.
function localIsoDate(date: Date): string {
  return formatIsoDate(new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())));
}
