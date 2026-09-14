import type { FormEvent } from "react";

interface PostingInputProps {
  url: string;
  pastedText: string;
  pasteOpen: boolean;
  isLoading: boolean;
  message?: string;
  onUrlChange: (value: string) => void;
  onPastedTextChange: (value: string) => void;
  onPasteToggle: () => void;
  onSubmit: () => void;
}

export function PostingInput({
  url,
  pastedText,
  pasteOpen,
  isLoading,
  message,
  onUrlChange,
  onPastedTextChange,
  onPasteToggle,
  onSubmit,
}: PostingInputProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <form className="flex flex-col gap-6" onSubmit={handleSubmit} noValidate>
      <p className="font-body text-[18px] leading-[1.4]">
        공고 링크를 넣으면 Notion 이력서와 대조해{" "}
        <strong className="font-medium">고쳐서 메울 수 있는 칸</strong>을 찾는다.
      </p>

      <div className="flex items-stretch gap-2">
        <input
          className="min-w-0 flex-1 rounded-xs border border-border-light bg-canvas px-4 py-3 font-body text-base leading-6 text-ink placeholder:text-muted focus:border-focus-input"
          type="url"
          value={url}
          onChange={(event) => onUrlChange(event.target.value)}
          placeholder="https://… 채용공고 링크"
          aria-label="채용공고 링크"
        />
        <button
          className="cursor-pointer whitespace-nowrap rounded-pill border border-transparent bg-near-black px-6 py-3 font-body text-sm leading-[1.71] font-medium text-canvas transition-[background] duration-150 ease-linear"
          type="submit"
        >
          {isLoading ? "분석 중" : "분석"}
        </button>
      </div>

      <button
        className="cursor-pointer self-start border-0 bg-transparent p-0 font-body text-sm leading-[1.4] text-ink underline underline-offset-4"
        type="button"
        onClick={onPasteToggle}
      >
        {pasteOpen ? "붙여넣기 닫기" : "공고 본문 직접 붙여넣기"}
      </button>

      {message ? (
        <p className="font-body text-sm leading-[1.4] text-error" role="alert">
          {message}
        </p>
      ) : null}

      {pasteOpen ? (
        <div className="flex flex-col gap-2">
          <label
            className="font-mono text-xs leading-[1.4] tracking-[0.28px] text-muted uppercase"
            htmlFor="posting-text"
          >
            공고 본문
          </label>
          <textarea
            className="min-h-[140px] resize-y rounded-xs border border-border-light bg-canvas px-4 py-3 font-body text-base leading-6 text-ink placeholder:text-muted focus:border-focus-input"
            id="posting-text"
            value={pastedText}
            onChange={(event) => onPastedTextChange(event.target.value)}
            placeholder="본문 추출이 실패하면 여기에 붙여넣는다."
          />
        </div>
      ) : null}
    </form>
  );
}
