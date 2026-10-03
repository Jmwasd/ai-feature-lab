import { useId, type ComponentProps, type ReactNode } from "react";

type TextInputProps = {
  label: string;
  error?: string;
  hint?: ReactNode;
  trailing?: ReactNode;
  // SearchBarPill 안의 세그먼트. 모바일에서는 일반 입력 상자, desktop에서는 테두리 없는 알약이 된다.
  segment?: boolean;
  // ref는 안쪽 <input>에 붙는다(React 19는 ref를 일반 prop으로 넘긴다).
} & Omit<ComponentProps<"input">, "children">;

// 텍스트 입력(UI_GUIDE §4 TextInput). 라벨이 필드 안 위에 쌓인다.
// 포커스는 2px 잉크 테두리만 쓴다(오류 중에는 오류색 유지). 테두리가 1px→2px로 두꺼워지는 만큼 안쪽 1px 여백을 빼서 크기를 유지한다.
const BOX = "flex h-input items-center gap-sm rounded-input border p-px transition-colors focus-within:border-2 focus-within:p-0";
const SEGMENT =
  "desktop:h-full desktop:flex-1 desktop:rounded-full desktop:border-0 desktop:p-0 desktop:focus-within:border-0 desktop:focus-within:bg-surface-soft";

export function TextInput({ label, error, hint, trailing, segment = false, disabled, className, id, ...rest }: TextInputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const messageId = `${inputId}-message`;
  const message = error ?? hint;

  const boxClass = [
    BOX,
    error ? "border-error-text" : "border-hairline focus-within:border-ink",
    disabled ? "bg-surface-soft" : "bg-canvas",
    segment ? SEGMENT : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={["flex min-w-0 flex-col gap-xs", segment ? "desktop:relative desktop:h-full desktop:flex-1" : "", className].filter(Boolean).join(" ")}>
      <div data-testid="text-input-box" className={boxClass}>
        <div className="flex min-w-0 flex-1 flex-col px-md">
          <label htmlFor={inputId} className="text-caption text-muted">
            {label}
          </label>
          <input
            id={inputId}
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={message ? messageId : undefined}
            className="w-full min-w-0 bg-transparent text-body-md text-ink outline-none placeholder:text-muted-soft disabled:text-muted-soft"
            {...rest}
          />
        </div>
        {trailing ? <div className="flex shrink-0 items-center pr-sm">{trailing}</div> : null}
      </div>
      {message ? (
        <p
          id={messageId}
          className={`px-xs text-caption-sm ${error ? "text-error-text" : "text-muted"} ${segment ? "desktop:absolute desktop:top-full desktop:mt-md" : ""}`}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
