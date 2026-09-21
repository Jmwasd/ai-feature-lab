import type { ReactNode } from "react";

export function EmptyState({ status, title, description, action }: {
  status: string;
  title: string;
  description: ReactNode;
  action: ReactNode;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-12">
      <div className="w-full max-w-[440px] text-center">
        <p className="font-mono text-[13px] text-muted">{status}</p>
        <h1 className="mt-3 text-2xl font-semibold leading-[1.3] text-ink">{title}</h1>
        <p className="mt-3 text-sm leading-[1.6] text-body-dim">{description}</p>
        <div className="mt-6">{action}</div>
      </div>
    </main>
  );
}
