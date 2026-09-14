export function PrivacyNotice() {
  return (
    <div className="flex flex-col gap-1.5 border-y border-hairline py-4 font-body text-sm leading-[1.4] text-slate">
      <span>분석하면 이력서 원문과 공고 본문이 OpenAI API로 전송된다.</span>
      <span>Notion은 지정한 이력서 페이지의 블록만 읽는다. 쓰기 권한은 쓰지 않는다.</span>
    </div>
  );
}
