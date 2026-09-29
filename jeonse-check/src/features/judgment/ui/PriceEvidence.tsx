import { formatIsoDate, formatWon } from "@/utils/format";
import { CONFIDENCE_LABEL, ESTIMATE_METHOD_LABEL } from "../copy";
import type { PriceEstimate } from "../price-estimate";

// 시세 추정 근거(UI_GUIDE §6 필수 요소 3): 방식, 신뢰도, 비교 거래 목록, 조회 구간.
// 해제 거래는 추정 단계에서 이미 빠져 있다.
export function PriceEvidence({ estimate }: { estimate: PriceEstimate }) {
  return (
    <section data-testid="price-evidence" aria-labelledby="price-evidence-title" className="flex flex-col gap-base">
      <h3 id="price-evidence-title" className="text-display-md text-ink">
        시세 추정 근거
      </h3>
      <dl className="flex flex-col gap-xs text-body-sm">
        <EvidenceRow term="추정 시세" value={estimate.price === null ? "-" : formatWon(estimate.price)} />
        <EvidenceRow term="방식" value={ESTIMATE_METHOD_LABEL[estimate.method]} />
        <EvidenceRow term="신뢰도" value={CONFIDENCE_LABEL[estimate.confidence]} />
        <EvidenceRow
          term="조회 구간"
          value={`${formatIsoDate(estimate.periodFrom)} ~ ${formatIsoDate(estimate.periodTo)}`}
        />
      </dl>
      <div data-testid="comparables" className="flex flex-col gap-sm">
        <p className="text-title-md text-ink">비교 거래 {estimate.comparables.length}건</p>
        {estimate.comparables.length === 0 ? (
          <p className="text-body-sm text-muted">추정에 쓴 비교 거래가 없어요.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-body-sm">
              <thead className="text-caption text-muted">
                <tr className="border-b border-hairline">
                  <th scope="col" className="py-xs pr-md font-regular">계약일</th>
                  <th scope="col" className="py-xs pr-md font-regular">전용면적</th>
                  <th scope="col" className="py-xs pr-md font-regular">층</th>
                  <th scope="col" className="py-xs pr-md font-regular">매매가</th>
                  <th scope="col" className="py-xs font-regular">건물명</th>
                </tr>
              </thead>
              <tbody className="tabular-nums text-ink">
                {estimate.comparables.map((t, i) => (
                  <tr key={i} data-testid="comparable-row" className="border-b border-hairline-soft">
                    <td className="py-xs pr-md">{formatIsoDate(t.contractDate)}</td>
                    <td className="py-xs pr-md">{t.exclusiveArea}㎡</td>
                    <td className="py-xs pr-md">{t.floor === null ? "-" : `${t.floor}층`}</td>
                    <td className="py-xs pr-md">{formatWon(t.price)}</td>
                    <td className="py-xs">{t.buildingName ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function EvidenceRow({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex justify-between gap-md border-t border-hairline-soft pt-xs">
      <dt className="shrink-0 text-muted">{term}</dt>
      <dd className="text-right tabular-nums text-ink">{value}</dd>
    </div>
  );
}
