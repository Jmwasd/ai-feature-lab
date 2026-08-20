"use client";

import { useRef } from "react";

import UploadPanel from "./UploadPanel";

interface LandingProps {
  isUploading: boolean;
  error: string | null;
  onUpload: (file: File) => void;
  onXlsxSelected: () => void;
}

const discoveryCards = [
  ["반복 결제", "무심코 이어진 결제를 횟수와 금액으로 드러냅니다."],
  ["이벤트 지출", "여행처럼 카테고리 사이에 흩어진 지출을 한 번에 묶습니다."],
  ["지출 집중도", "상위 몇 건이 전체 소비를 얼마나 좌우하는지 보여 줍니다."],
  ["모르는 지출", "추측하지 않습니다. 미분류 항목은 고칠 수 있도록 남깁니다."],
] as const;

export default function Landing({
  isUploading,
  error,
  onUpload,
  onXlsxSelected,
}: LandingProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <main>
      <section className="bg-ink">
        <div className="mx-auto grid min-h-[600px] max-w-[1000px] gap-14 px-6 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <p className="inline-flex rounded-full bg-surface-dark px-3 py-1.5 text-[12px] font-semibold tracking-[0.4px] text-bg">
              소비 발견 리포트
            </p>
            <h1 className="mt-5 max-w-[560px] text-[48px] font-normal leading-[1.02] tracking-[-1.6px] text-bg sm:text-[60px]">
              은행 앱이 말해주지 않는 소비의 사실
            </h1>
            <p className="mt-6 max-w-[520px] text-lg leading-[1.55] text-text-ondark">
              CSV 한 장에서 반복 결제, 이벤트 지출, 집중된 소비를 찾아 한 화면에 정리합니다.
            </p>
            <div className="mt-9">
              <UploadPanel
                inputRef={inputRef}
                isUploading={isUploading}
                error={error}
                onUpload={onUpload}
                onXlsxSelected={onXlsxSelected}
              />
            </div>
            <a className="mt-5 inline-block text-[15px] font-semibold text-bg underline underline-offset-4 hover:text-text-ondark" href="#discoveries">
              샘플 리포트 열어보기 →
            </a>
          </div>

          <div className="relative hidden min-h-[390px] lg:block" aria-label="샘플 리포트 미리보기">
            <div className="absolute inset-x-5 top-9 h-[310px] rotate-[4deg] rounded-3xl bg-surface-dark" />
            <div className="absolute inset-x-0 top-0 rounded-3xl bg-surface-dark p-10 shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
              <p className="text-[12px] font-semibold tracking-[0.4px] text-text-ondark">이번 기간의 발견</p>
              <p className="mt-5 font-mono text-[52px] font-medium leading-none tracking-[-1.5px] text-blue">37%</p>
              <p className="mt-2 text-[15px] leading-6 text-bg">한 번의 이벤트가 차지한 소비</p>
              <div className="mt-10 space-y-4">
                {["w-full", "w-[84%]", "w-[66%]", "w-[51%]", "w-[38%]", "w-[24%]"].map((width, index) => (
                  <div className="flex items-center gap-3" key={width}>
                    <span className="font-mono text-[12px] font-medium text-text-ondark">0{index + 1}</span>
                    <span className={`h-2 rounded-full bg-line-dark ${width}`} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="discoveries" className="mx-auto max-w-[1000px] px-6 py-24">
        <p className="text-[13px] font-semibold tracking-[0.4px] text-text-muted">WHAT TO LOOK FOR</p>
        <h2 className="mt-3 text-[36px] font-normal leading-tight tracking-[-0.5px] text-ink">
          은행 앱이 말해주지 않는 것
        </h2>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {discoveryCards.map(([title, description], index) => (
            <article className="rounded-3xl border border-line p-8" key={title}>
              <p className="font-mono text-[13px] font-medium tabular-nums text-text-muted">0{index + 1}</p>
              <h3 className="mt-9 text-xl font-semibold text-ink">{title}</h3>
              <p className="mt-3 text-[15px] leading-6 text-text-body">{description}</p>
            </article>
          ))}
        </div>
        <button
          className="mt-10 rounded-full bg-blue px-8 py-4 text-base font-semibold text-bg transition-colors hover:bg-blue-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue"
          type="button"
          onClick={() => inputRef.current?.click()}
        >
          CSV 파일 선택
        </button>
      </section>
    </main>
  );
}
