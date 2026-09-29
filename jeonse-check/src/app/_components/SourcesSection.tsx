"use client";

import { useId, useState } from "react";
import { HUG_GUARANTEE, PRICE_ESTIMATE } from "@/consts/policy";
import { SOURCES } from "@/features/judgment/copy";
import { useContentSwap } from "@/hooks/use-content-swap";
import { formatPercent } from "@/utils/format";
import { LandingSection } from "./LandingSection";
import { useRovingTabs } from "./use-roving-tabs";

const [TRADE_SOURCE, OFFICIAL_PRICE_SOURCE, BUILDING_SOURCE, USER_INPUT_SOURCE] = SOURCES;

// "지원 안 함"은 PRD MVP 제외 사항과 그 이유만 쓴다. 지원 약속은 쓰지 않는다.
const GROUPS = [
  {
    label: "자동 조회",
    intro: "주소를 넣으면 공공데이터를 자동으로 불러와요.",
    items: [
      {
        name: TRADE_SOURCE,
        detail: `아파트·연립다세대 매매 실거래로 추정 시세를 계산해요. 해제된 거래는 빼고, 최근 ${PRICE_ESTIMATE.reportingDelayDays}일 거래는 신고가 덜 됐을 수 있다고 함께 알려 드려요.`,
      },
      {
        name: OFFICIAL_PRICE_SOURCE,
        detail: `비교할 거래가 부족할 때 시세 추정에 쓰고, HUG 보증 가입 기준(공시가격 × ${formatPercent(HUG_GUARANTEE.combinedRatio)})을 계산할 때 써요.`,
      },
      { name: BUILDING_SOURCE, detail: "주용도, 위반건축물 여부, 사용승인일로 건물 위험 신호를 찾아요." },
    ],
  },
  {
    label: "직접 입력",
    intro: "등기부 권리관계는 공개 API가 없어 등기부등본을 보고 직접 넣어요. 판정은 입력한 값 기준이에요.",
    items: [
      {
        name: USER_INPUT_SOURCE,
        detail: "근저당 채권최고액과 선순위 보증금으로 부채비율과 HUG 보증 가입 기준을 계산해요.",
      },
      { name: "신탁 등기 여부", detail: "신탁 등기가 있으면 임대 권한을 확인해야 한다는 신호로 알려 드려요." },
      { name: "최근 소유자 변동", detail: "소유자 변동일을 넣으면 최근에 바뀌었는지 함께 봐요." },
    ],
  },
  {
    label: "지원 안 함",
    intro: "아래 항목은 이 서비스에서 다루지 않아요. 계약 전에 직접 확인하세요.",
    items: [
      { name: "다가구·단독주택", detail: "먼저 들어온 임차인의 보증금을 파악하기 어려워 판정할 수 없어요." },
      { name: "오피스텔", detail: "아파트·연립다세대만 다뤄요." },
      {
        name: "등기부등본·확정일자 현황·국세 체납 자동 조회",
        detail: "공개 API가 없어 자동으로 불러올 수 없어요.",
      },
      { name: "KB시세", detail: "공개 API가 없어 연동하지 않아요. 시세는 실거래가와 공시가격으로 추정해요." },
    ],
  },
] as const;

export function SourcesSection() {
  const baseId = useId();
  const [selected, setSelected] = useState(0);
  const { shown, hidden } = useContentSwap(selected);
  const { tabRef, onKeyDown } = useRovingTabs(GROUPS.length, setSelected);
  const tabId = (i: number) => `${baseId}-tab-${i}`;
  const panelId = `${baseId}-panel`;
  const group = GROUPS[shown];

  // 출처 문구에는 등장 모션을 주지 않는다(UI_GUIDE §5). 토글 전환의 내용 교체만 둔다.
  return (
    <LandingSection id="sources" title="데이터 출처">
      <div className="mt-xl flex">
        <div role="tablist" aria-label="데이터 출처 구분" className="inline-flex rounded-full border border-hairline p-0.5">
          {GROUPS.map((item, i) => (
            <button
              key={item.label}
              ref={tabRef(i)}
              id={tabId(i)}
              type="button"
              role="tab"
              aria-selected={i === selected}
              aria-controls={panelId}
              tabIndex={i === selected ? 0 : -1}
              onClick={() => setSelected(i)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={`h-10 rounded-full px-base text-button-sm transition-colors ${
                i === selected ? "bg-ink text-canvas" : "text-ink hover:bg-surface-soft"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={tabId(shown)}
        tabIndex={0}
        className={`mt-xl flex max-w-prose flex-col gap-base transition-[opacity,transform,filter] duration-340 ease-fade ${
          hidden ? "translate-y-2.5 opacity-0 blur-xs" : ""
        }`}
      >
        <p className="text-body-md text-body">{group.intro}</p>
        <ul>
          {group.items.map((item, i) => (
            <li
              key={item.name}
              className={`flex flex-col gap-xs border-t border-hairline-soft py-base transition-[opacity,transform,filter] duration-340 ease-fade ${
                hidden ? "translate-y-2.5 opacity-0 blur-xs" : ""
              }`}
              style={{ transitionDelay: hidden ? "0ms" : `${i * 100}ms` }}
            >
              <span className="text-title-md text-ink">{item.name}</span>
              <span className="text-body-sm text-body">{item.detail}</span>
            </li>
          ))}
        </ul>
      </div>
    </LandingSection>
  );
}
