// 워드마크의 마름모 마크. TopNav와 로그인 모달이 같은 마크를 쓴다.
export function BrandMark() {
  return (
    <span aria-hidden="true" className="grid size-5.5 rotate-45 place-items-center rounded-sm border-2 border-ink">
      <span className="size-1.5 rounded-full bg-primary" />
    </span>
  );
}
