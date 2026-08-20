import type { ChangeEvent, DragEvent, RefObject } from "react";

interface UploadPanelProps {
  inputRef: RefObject<HTMLInputElement | null>;
  isUploading: boolean;
  error: string | null;
  onUpload: (file: File) => void;
  onXlsxSelected: () => void;
}

export default function UploadPanel({
  inputRef,
  isUploading,
  error,
  onUpload,
  onXlsxSelected,
}: UploadPanelProps) {
  function handleFiles(files: FileList | null): void {
    const file = files?.[0];

    if (!file) {
      return;
    }

    if (file.name.toLowerCase().endsWith(".xlsx")) {
      onXlsxSelected();
      return;
    }

    onUpload(file);
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    handleFiles(event.target.files);
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    handleFiles(event.dataTransfer.files);
  }

  return (
    <div
      id="upload"
      className="no-print rounded-3xl border-2 border-dashed border-line-dark bg-surface-dark p-7"
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept=".csv,.xlsx,text/csv"
        onChange={handleChange}
      />
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <span
            aria-hidden="true"
            className="flex size-[52px] shrink-0 items-center justify-center rounded-[14px] bg-ink font-mono text-[28px] font-medium text-bg"
          >
            ↑
          </span>
          <div>
            <p className="text-base font-semibold text-bg">CSV 거래내역 올리기</p>
            <p className="mt-1 text-[13px] leading-5 text-text-ondark">
              파일을 끌어 놓거나 선택하세요. 분석이 끝나면 파일은 저장하지 않습니다.
            </p>
          </div>
        </div>
        <button
          className="shrink-0 rounded-full bg-blue px-5 py-3 text-[15px] font-semibold text-bg transition-colors hover:bg-blue-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue"
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? "분석 중" : "파일 선택"}
        </button>
      </div>

      <ol className="mt-6 grid gap-3 border-t border-line-dark pt-5 text-[13px] leading-5 text-text-ondark sm:grid-cols-3">
        <li>
          <span className="font-mono font-medium text-bg">01</span>
          <p className="mt-1">토스뱅크의 `.xlsx`를 엑셀·넘버스·구글시트로 엽니다.</p>
        </li>
        <li>
          <span className="font-mono font-medium text-bg">02</span>
          <p className="mt-1">파일 비밀번호를 입력합니다.</p>
        </li>
        <li>
          <span className="font-mono font-medium text-bg">03</span>
          <p className="mt-1">`CSV`로 내보낸 뒤 이곳에 올립니다.</p>
        </li>
      </ol>

      {error ? (
        <p aria-live="polite" className="mt-5 border-t border-line-dark pt-5 text-sm leading-6 text-bg">
          {error}
        </p>
      ) : null}
    </div>
  );
}
