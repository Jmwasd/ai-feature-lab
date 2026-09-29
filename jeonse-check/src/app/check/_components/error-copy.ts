// /check 오류 화면 문구 원본이다. 오류 화면은 이 파일의 문구만 쓴다.
// docs/UI_GUIDE.md §6 금지 표현을 쓰지 않는다. 데이터가 없는 것은 위험이 없는 것이 아니므로
// 오류 화면에서 신호 개수나 "위험 신호" 헤드라인처럼 판정 결과로 읽힐 표현을 쓰지 않는다.

import type { CheckError } from "../_actions/run-check";

type ErrorCopy = { title: string; description: string; action: string };

export const CHECK_ERROR_COPY = {
  "invalid-input": {
    title: "입력한 내용을 다시 확인해 주세요",
    description: "빠졌거나 형식이 맞지 않는 값이 있어 조회하지 못했어요. 입력한 값은 그대로 남아 있어요",
    action: "입력 다시 확인하기",
  },
  "address-not-found": {
    title: "주소를 다시 검색해 주세요",
    description: "선택한 주소를 주소 데이터에서 다시 찾지 못했어요. 주소를 다시 검색해 목록에서 골라 주세요",
    action: "주소 다시 검색하기",
  },
  "unsupported-house": {
    title: "지원하지 않는 주택 유형이에요",
    description: "지금은 아파트와 연립다세대만 확인할 수 있어요. 다가구·단독주택과 오피스텔은 지원하지 않아요",
    action: "처음으로",
  },
  quota: {
    title: "공공데이터 조회가 몰려 있어요",
    description: "공공데이터 호출 한도에 걸려 결과를 만들지 못했어요. 잠시 뒤 다시 시도해 주세요",
    action: "다시 시도",
  },
  "lookup-failed": {
    title: "공공데이터를 불러오지 못했어요",
    description: "실거래가·공시가격·건축물대장을 가져오지 못해 결과를 만들지 못했어요. 잠시 뒤 다시 시도해 주세요",
    action: "다시 시도",
  },
  unauthorized: {
    title: "다시 로그인해 주세요",
    description: "로그인이 끝나 조회를 이어 갈 수 없어요. 로그인한 뒤 다시 조회해 주세요",
    action: "다시 로그인하기",
  },
} as const satisfies Record<CheckError, ErrorCopy>;

// 예상 못 한 예외(error.tsx). 원인을 알 수 없으므로 일반 안내만 둔다.
export const ROUTE_ERROR_COPY = {
  title: "화면을 불러오지 못했어요",
  description: "예상하지 못한 문제가 생겼어요. 다시 시도해도 같으면 잠시 뒤 다시 들어와 주세요",
  action: "다시 시도",
} as const satisfies ErrorCopy;
