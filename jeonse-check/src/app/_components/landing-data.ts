// 랜딩 3D 장면에 띄우는 예시 내용. 신호 이름은 실제 판정 문구(copy.ts)를 쓰고, 기준 수치는 policy.ts에서 가져온다.
// 예시 일러스트이므로 결과 화면에 쓰지 않는다(UI_GUIDE §6 예외).

import { HUG_GUARANTEE, JEONSE_RATIO_THRESHOLD } from "@/consts/policy";
import { SIGNAL_COPY } from "@/features/judgment/copy";
import { formatPercent } from "@/utils/format";
import { DEMO_DEPOSIT, DEMO_HOUSE } from "./landing-demo";

// 01 숨은 위험 — 집 주변에 떠오르는 신호
export const RISK_MARKERS = [
  {
    name: SIGNAL_COPY["jeonse-ratio-danger"].title,
    desc: `보증금이 추정 시세의 ${formatPercent(JEONSE_RATIO_THRESHOLD.danger)}를 넘으면 경매 때 돌려받기 어려워져요.`,
  },
  { name: SIGNAL_COPY["debt-ratio-danger"].title, desc: "근저당과 선순위 보증금이 많으면 경매 때 보증금이 뒤로 밀려요." },
  {
    name: "HUG 보증 가입 어려움",
    desc: `보증금과 선순위채권이 공시가격의 ${formatPercent(HUG_GUARANTEE.combinedRatio)}를 넘으면 반환보증 가입이 어려워요.`,
  },
  { name: SIGNAL_COPY["trust-registered"].title, desc: "임대 권한이 신탁회사에 있으면 집주인과 맺은 계약이 보호받지 못할 수 있어요." },
  { name: SIGNAL_COPY["violation-building"].title, desc: "건축물대장에 위반건축물로 오르면 전세보증·전세대출이 막힐 수 있어요." },
  { name: SIGNAL_COPY["recent-ownership-change"].title, desc: "계약 직전 집주인이 바뀌었다면 새 집주인의 반환 능력을 따져 봐야 해요." },
] as const;

// 02 분석 — 집 옆에 붙는 데이터 카드. p는 3D 좌표, side는 선이 뻗는 방향이다.
export type DataCard = {
  key: string;
  to: number;
  kind: "won" | "ratio" | "count";
  sub: string;
  p: [number, number, number];
  side: "l" | "r";
};

export const DATA_CARDS: DataCard[] = [
  { key: "보증금", to: DEMO_DEPOSIT.initial, kind: "won", sub: "계약 예정 금액", p: [-1.9, 4.0, 1.4], side: "l" },
  { key: "추정 시세", to: DEMO_HOUSE.marketPrice, kind: "won", sub: "실거래 6건 기준", p: [1.9, 3.4, 1.4], side: "r" },
  { key: "근저당", to: DEMO_HOUSE.maxClaimAmount, kind: "won", sub: "입력한 등기부 기준", p: [-1.9, 1.9, 1.4], side: "l" },
  { key: "전세가율", to: DEMO_DEPOSIT.initial / DEMO_HOUSE.marketPrice, kind: "ratio", sub: "보증금 ÷ 추정 시세", p: [1.9, 1.3, 1.4], side: "r" },
  { key: "공공데이터", to: 3, kind: "count", sub: "실거래가 · 공시가격 · 건축물대장", p: [0, 5.6, 0.4], side: "r" },
];

export const SCAN_SOURCES = [
  { name: "실거래가", org: "국토교통부" },
  { name: "공동주택 공시가격", org: "한국부동산원" },
  { name: "건축물대장", org: "세움터" },
] as const;

// 장면별 카메라 위치(p)와 바라보는 높이(ty), 옆으로 비켜서는 정도(sh)
export const CAMERA_KEYS = [
  { p: [0, 2.7, 13.5], ty: 2.4, sh: 0 },
  { p: [7.8, 3.9, 8.8], ty: 2.5, sh: 2.4 },
  { p: [-6.2, 8.4, 7.6], ty: 1.9, sh: -2.4 },
  { p: [0.8, 3.4, 13.8], ty: 3.0, sh: 3.2 },
  { p: [0, 1.4, 12.8], ty: 3.7, sh: 0 },
] as const;
