import { ColumnHeader } from "@/components/ColumnHeader";
import { CoveredCard } from "@/components/CoveredCard";
import { ImplicitCard } from "@/components/ImplicitCard";
import { MissingRow } from "@/components/MissingRow";
import type { AnalysisResult } from "@/types";

interface ResultColumnsProps {
  result: AnalysisResult;
}

export function ResultColumns({ result }: ResultColumnsProps) {
  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
      <section className="order-2 flex flex-col gap-4 lg:order-1">
        <ColumnHeader title="갖춘 것" count={result.covered.length} />
        {result.covered.map((item) => (
          <CoveredCard key={item.requirement.id} item={item} />
        ))}
      </section>

      <section className="order-1 flex flex-col gap-4 lg:order-2">
        <ColumnHeader
          title="안 쓴 것"
          count={result.implicit.length}
          variant="accent"
          description="근거는 있는데 공고의 용어로 안 적혀 있다. 여기부터 고친다."
        />
        {result.implicit.map((item) => (
          <ImplicitCard key={item.requirement.id} item={item} />
        ))}
      </section>

      <section className="order-3 flex flex-col gap-4">
        <ColumnHeader title="없는 것" count={result.missing.length} />
        {result.missing.map((item) => (
          <MissingRow key={item.requirement.id} item={item} />
        ))}
      </section>
    </div>
  );
}
