import type { Report } from "../types/report";

interface FooterNoteProps {
  report: Report;
  onPrint: () => void;
}

export default function FooterNote({ report, onPrint }: FooterNoteProps) {
  const periodNotes = report.notes.length > 0
    ? report.notes
    : ["더 긴 조회기간을 올리면 반복 결제와 소비 흐름을 더 신뢰도 높게 확인할 수 있습니다."];

  return (
    <footer className="mt-12 rounded-3xl bg-fill-quiet p-8 sm:p-10">
      <div className="space-y-4 text-[13px] leading-6 text-text-body">
        {periodNotes.map((note) => (
          <p key={note}>{note}</p>
        ))}
        <p>
          업로드 파일은 저장되지 않으며, 분류되지 않은 가맹점명은 OpenAI로 전송될 수 있습니다. 금액·계좌번호·성명은 전송하지 않습니다.
        </p>
      </div>
      <button
        className="no-print mt-7 rounded-full bg-ink px-6 py-3.5 text-[15px] font-semibold text-bg transition-colors hover:bg-surface-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue"
        type="button"
        onClick={onPrint}
      >
        PDF로 내보내기
      </button>
    </footer>
  );
}
