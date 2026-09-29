import { Button } from "@/components/Button";
import { DISCLAIMER } from "@/features/judgment/copy";

// 면책 문구가 있으므로 등장 모션을 주지 않는다(UI_GUIDE §5).
export function FinalCta() {
  return (
    <section id="final-cta" aria-labelledby="final-cta-title" className="border-t border-hairline-soft px-gutter py-section">
      <div className="mx-auto flex max-w-prose flex-col items-center gap-lg text-center">
        <h2 id="final-cta-title" className="text-display-md text-ink">
          계약 전에 확인하세요
        </h2>
        <Button href="/check">지금 확인하기</Button>
        <p className="text-body-sm text-body">{DISCLAIMER}</p>
      </div>
    </section>
  );
}
