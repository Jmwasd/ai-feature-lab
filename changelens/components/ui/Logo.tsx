export function Logo({ markOnly = false }: { markOnly?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2" aria-label={markOnly ? "changelens" : undefined}>
      <span aria-hidden="true" className="h-[18px] w-[18px] shrink-0 rounded-md bg-accent" />
      {!markOnly && <span className="font-mono text-base font-semibold text-body">changelens</span>}
    </span>
  );
}
