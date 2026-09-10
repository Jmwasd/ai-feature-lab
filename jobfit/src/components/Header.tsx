export function Header() {
  return (
    <header className="flex h-14 items-center justify-between border-b border-hairline px-6">
      <span className="font-display text-[18px] leading-[1.2] tracking-[-0.36px]">jobfit</span>
      <span className="font-mono text-xs leading-[1.4] tracking-[0.28px] uppercase text-muted">
        local · 저장 없음
      </span>
    </header>
  );
}
