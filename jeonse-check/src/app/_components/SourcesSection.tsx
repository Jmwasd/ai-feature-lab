"use client";

import { Ban, Building2, CircleSlash, Database, FileLock, Landmark, Pencil, PencilLine, RefreshCw, type LucideIcon } from "lucide-react";
import Image from "next/image";
import { useId, useState } from "react";
import { HUG_GUARANTEE } from "@/consts/policy";
import { useContentSwap } from "@/hooks/use-content-swap";
import { formatPercent } from "@/utils/format";
import { LandingSection, SectionHeading } from "./LandingSection";
import { Reveal } from "./Reveal";
import { swapStyle } from "./swap-style";
import { useRovingTabs } from "./use-roving-tabs";

// 기관 카드. 로고 파일은 public/images/sources/에 두고, 쓸 만한 로고가 없는 기관은 아이콘으로 대신한다(랜딩 시안).
const AGENCIES: { name: string; desc: string; logo?: string; icon: LucideIcon }[] = [
  { name: "국토교통부", desc: "실거래가 공개시스템", icon: Landmark },
  { name: "공공데이터포털", desc: "data.go.kr", logo: "/images/sources/data-go-kr.png", icon: Database },
  { name: "한국부동산원", desc: "공동주택 공시가격", icon: Building2 },
  { name: "세움터", desc: "건축물대장", logo: "/images/sources/eais.png", icon: FileLock },
  { name: "인터넷등기소", desc: "등기사항증명서", icon: FileLock },
];

// "지원 안 함"은 PRD MVP 제외 사항이다.
const GROUPS: { label: string; icon: LucideIcon; rowIcon: LucideIcon; rows: { item: string; src: string }[] }[] = [
  {
    label: "자동 조회",
    icon: RefreshCw,
    rowIcon: Database,
    rows: [
      { item: "실거래가", src: "국토교통부 아파트·연립다세대 매매 실거래가. 법정동·계약월 단위로 모아 두고, 해제된 거래는 빼요." },
      { item: "공시가격", src: `공동주택 공시가격. HUG 주택가격 기준(×${formatPercent(HUG_GUARANTEE.combinedRatio)}) 계산에 써요.` },
      { item: "건축물대장", src: "용도, 위반건축물 여부, 사용승인일을 확인해요." },
      { item: "주소 정규화", src: "지번과 도로명을 같은 집으로 맞추고 전용면적 기준으로 비교해요." },
    ],
  },
  {
    label: "직접 입력",
    icon: Pencil,
    rowIcon: PencilLine,
    rows: [
      { item: "근저당 채권최고액", src: "등기부 을구에서 말소되지 않은 근저당을 모두 더해 입력해요." },
      { item: "신탁 여부", src: "등기부 갑구에 신탁·수탁자가 있는지 봐요." },
      { item: "최근 소유자 변동", src: "갑구의 마지막 소유권 이전 접수일을 봐요." },
    ],
  },
  {
    label: "지원 안 함",
    icon: Ban,
    rowIcon: CircleSlash,
    rows: [
      { item: "다가구·단독주택", src: "먼저 들어온 세입자의 보증금을 파악하기 어려워 지원하지 않아요." },
      { item: "오피스텔", src: "아직 지원하지 않아요." },
      { item: "등기부·확정일자·국세 체납 자동 조회", src: "공개 API가 없어 직접 확인해야 해요." },
      { item: "KB시세", src: "공개 API가 없어 연동하지 않아요." },
    ],
  },
];


// 내용 교체: 목록 전체와 행(90ms씩 지연)의 전환 시간.
const SWAP_LIST = { fadeMs: 380, riseMs: 560, shiftPx: 8, blurPx: 5 };
const SWAP_ROW = { fadeMs: 480, riseMs: 680, shiftPx: 8, blurPx: 5 };

export function SourcesSection() {
  const baseId = useId();
  const [selected, setSelected] = useState(0);
  const { shown, hidden } = useContentSwap(selected);
  const { tabRef, onKeyDown } = useRovingTabs(GROUPS.length, setSelected);
  const tabId = (i: number) => `${baseId}-tab-${i}`;
  const panelId = `${baseId}-panel`;
  const group = GROUPS[shown];
  const RowIcon = group.rowIcon;

  return (
    <LandingSection id="sources" className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] items-start gap-x-16 gap-y-xl">
      <div className="grid gap-base">
        <SectionHeading
          id="sources"
          icon={<Database size={18} />}
          title="무엇을 어디서 가져오나요"
          description="공공데이터로 자동 조회하는 것과 직접 확인해야 하는 것을 나눠 둬요."
        />
        <Reveal delayMs={200} className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-sm">
          {AGENCIES.map(({ name, desc, logo, icon: Icon }) => (
            <div key={name} className="flex min-w-0 items-center gap-2.5 rounded-card border border-hairline bg-canvas px-md py-2.5">
              <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-sm border border-hairline-soft bg-canvas text-ink">
                {logo ? <Image src={logo} alt={`${name} 로고`} width={28} height={28} /> : <Icon aria-hidden="true" size={18} />}
              </span>
              <span className="grid min-w-0 gap-px">
                <span className="text-button-sm text-ink">{name}</span>
                <span className="text-caption-sm text-muted">{desc}</span>
              </span>
            </div>
          ))}
        </Reveal>
        <Reveal delayMs={260}>
          <div role="tablist" aria-label="데이터 출처 구분" className="flex w-max max-w-full rounded-full border border-hairline p-0.5">
            {GROUPS.map((item, i) => {
              const Icon = item.icon;
              const current = i === selected;
              return (
                <button
                  key={item.label}
                  ref={tabRef(i)}
                  id={tabId(i)}
                  type="button"
                  role="tab"
                  aria-selected={current}
                  aria-controls={panelId}
                  tabIndex={current ? 0 : -1}
                  onClick={() => setSelected(i)}
                  onKeyDown={(e) => onKeyDown(e, i)}
                  className={`flex items-center gap-1.5 rounded-full px-3.5 py-sm text-caption transition-colors duration-320 ${
                    current ? "bg-ink text-canvas" : "bg-transparent text-ink"
                  }`}
                >
                  <Icon aria-hidden="true" size={14} />
                  {item.label}
                </button>
              );
            })}
          </div>
        </Reveal>
      </div>
      <ul
        id={panelId}
        role="tabpanel"
        aria-labelledby={tabId(shown)}
        tabIndex={0}
        className="grid"
        style={swapStyle(hidden, SWAP_LIST)}
      >
        {group.rows.map((row, i) => (
          <li
            key={row.item}
            data-testid="source-row"
            className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-x-lg gap-y-xs border-t border-hairline-soft py-base"
            style={swapStyle(hidden, SWAP_ROW, i * 90)}
          >
            <span className="flex items-start gap-sm text-title-md text-ink">
              <RowIcon aria-hidden="true" size={16} className="mt-xxs shrink-0 text-muted" />
              <span data-source-item>{row.item}</span>
            </span>
            <span className="text-body-sm text-pretty text-body">{row.src}</span>
          </li>
        ))}
      </ul>
    </LandingSection>
  );
}
