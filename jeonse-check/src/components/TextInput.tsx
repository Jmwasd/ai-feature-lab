import { useId, type ComponentProps, type ReactNode } from "react";

type TextInputProps = {
  label: string;
  error?: string;
  hint?: ReactNode;
  trailing?: ReactNode;
  // ref는 안쪽 <input>에 붙는다(React 19는 ref를 일반 prop으로 넘긴다).
} & Omit<ComponentProps<"input">, "children">;

// 텍스트 입력(UI_GUIDE §4 TextInput). 모노 라벨이 상자 위에, 힌트·오류가 상자 아래에 온다.
// 포커스는 2px 잉크 테두리만 쓴다(오류 중에는 오류색 유지). 테두리가 1px→2px로 두꺼워지는 만큼 안쪽 1px 여백을 빼서 크기를 유지한다.
const BOX = "flex h-input items-center gap-sm rounded-input border p-px transition-colors focus-within:border-2 focus-within:p-0";

export function TextInput({ label, error, hint, trailing, disabled, className, id, ...rest }: TextInputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const messageId = `${inputId}-message`;
  const message = error ?? hint;

  const boxClass = [
    BOX,
    error ? "border-error-text" : "border-hairline focus-within:border-ink",
    disabled ? "bg-surface-strong" : "bg-ink/5",
  ].join(" ");

  return (
    <div className={["flex min-w-0 flex-col gap-sm", className].filter(Boolean).join(" ")}>
      <label htmlFor={inputId} className="font-mono text-badge tracking-wider text-data-soft">
        {label}
      </label>
      <div data-testid="text-input-box" className={boxClass}>
        <input
          id={inputId}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={message ? messageId : undefined}
          className="h-full w-full min-w-0 bg-transparent px-base text-body-md text-ink outline-none placeholder:text-muted-soft disabled:text-muted-soft"
          {...rest}
        />
        {trailing ? <div className="flex shrink-0 items-center pr-sm">{trailing}</div> : null}
      </div>
      {message ? (
        <p id={messageId} className={`text-caption-sm ${error ? "text-error-text" : "text-muted"}`}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
