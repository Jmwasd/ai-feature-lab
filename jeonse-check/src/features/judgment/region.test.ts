import { describe, expect, it } from "vitest";
import {
  PRIORITY_REPAYMENT_REGION,
  PRIORITY_REPAYMENT_REGION_CODES,
  SIDO_CODES,
} from "@/consts/policy";
import { isCapitalArea, priorityRegionTier } from "./region";

const { SEOUL, OVERCROWDED_CAPITAL, METROPOLITAN, OTHER } = PRIORITY_REPAYMENT_REGION;

describe("priorityRegionTier", () => {
  it.each([
    ["1168010100", "서울 강남구 역삼동", SEOUL],
    ["1111010100", "서울 종로구 청운동", SEOUL],
  ])("%s(%s)는 서울 구간이다", (admCd, _name, tier) => {
    expect(priorityRegionTier(admCd)).toBe(tier);
  });

  it.each([
    ["2823710100", "인천 부평구 부평동", OVERCROWDED_CAPITAL],
    ["2812510100", "인천 제물포구 만석동", OVERCROWDED_CAPITAL],
    ["2818510500", "인천 연수구 동춘동", OVERCROWDED_CAPITAL],
    ["2820010100", "인천 남동구 구월동", OVERCROWDED_CAPITAL],
    ["2827510100", "인천 서해구 검암동", OVERCROWDED_CAPITAL],
    ["2829010100", "인천 검단구 백석동", OVERCROWDED_CAPITAL],
    ["2829010600", "인천 검단구 대곡동(과밀억제권역 제외)", METROPOLITAN],
    ["2829010500", "인천 검단구 원당동(과밀억제권역 제외)", METROPOLITAN],
    ["2871025021", "인천 강화군 강화읍", OTHER],
    ["2872031021", "인천 옹진군", OTHER],
  ])("%s(%s)는 %s다", (admCd, _name, tier) => {
    expect(priorityRegionTier(admCd)).toBe(tier);
  });

  it.each([
    ["4111112900", "수원시 장안구 파장동"],
    ["4113510300", "성남시 분당구"],
    ["4115010100", "의정부시"],
    ["4119210100", "부천시 원미구"],
    ["4128510100", "고양시 일산동구"],
    ["4129010100", "과천시"],
    ["4145010100", "하남시"],
    ["4136010100", "남양주시 호평동"],
    ["4136011000", "남양주시 도농동"],
  ])("경기 과밀억제권역 %s(%s)는 과밀억제권역 구간이다", (admCd) => {
    expect(priorityRegionTier(admCd)).toBe(OVERCROWDED_CAPITAL);
  });

  it.each([
    ["3611010100", "세종"],
    ["4146510100", "용인시 수지구"],
    ["4146125021", "용인시 처인구 포곡읍"],
    ["4159710100", "화성시 동탄구"],
    ["4159000000", "화성시(시 단위 코드)"],
    ["4157010100", "김포시"],
  ])("%s(%s)는 과밀억제권역 구간과 같다", (admCd) => {
    expect(priorityRegionTier(admCd)).toBe(OVERCROWDED_CAPITAL);
  });

  it.each([
    ["2635010100", "부산 해운대구"],
    ["2726010100", "대구 수성구"],
    ["3020010100", "대전 유성구"],
    ["3111010100", "울산 중구"],
    ["4127310100", "안산시 단원구"],
    ["4161010100", "광주시"],
    ["4148010100", "파주시"],
    ["4150010100", "이천시"],
    ["4122010100", "평택시"],
  ])("%s(%s)는 광역시 구간이다", (admCd) => {
    expect(priorityRegionTier(admCd)).toBe(METROPOLITAN);
  });

  it.each([
    ["2671025021", "부산 기장군"],
    ["2771025021", "대구 달성군"],
    ["2772025021", "대구 군위군"],
    ["3171025021", "울산 울주군"],
    ["1271025021", "전남광주통합특별시 담양군"],
    ["4136025021", "남양주시 와부읍(과밀억제권역 밖)"],
    ["4137010100", "오산시"],
    ["4183025021", "양평군"],
    ["5111010100", "강원 춘천시"],
    ["4311110100", "충북 청주시"],
    ["4711110100", "경북 포항시 남구"],
    ["5011010100", "제주시"],
    ["5211110100", "전북 전주시"],
  ])("%s(%s)는 그 밖의 지역이다", (admCd) => {
    expect(priorityRegionTier(admCd)).toBe(OTHER);
  });

  it.each([
    ["2815510300", "인천 영종구 운서동(인천경제자유구역)"],
    ["2818510600", "인천 연수구 송도동(인천경제자유구역)"],
    ["2827511100", "인천 서해구 청라동(인천경제자유구역)"],
    ["2820011100", "인천 남동구 고잔동(남동 국가산업단지)"],
    ["4139013200", "시흥시 정왕동(반월특수지역)"],
    ["4139010100", "시흥시 대야동"],
    ["4136011200", "남양주시 다산동"],
    ["1230010100", "전남광주통합특별시 북구"],
    ["1211010100", "전남광주통합특별시 목포시"],
  ])("모호 지역 %s(%s)는 null이다", (admCd) => {
    expect(priorityRegionTier(admCd)).toBeNull();
  });

  it.each([
    ["2811010100", "폐지된 인천 중구 코드"],
    ["4199910100", "목록에 없는 경기 시군구"],
    ["9911010100", "없는 시도"],
  ])("목록에 없는 코드 %s(%s)는 추정하지 않고 null이다", (admCd) => {
    expect(priorityRegionTier(admCd)).toBeNull();
  });

  it.each(["", "11680", "116801010", "11680101001", "11680a0100", " 1168010100"])(
    "형식이 잘못된 코드 %j는 null이다",
    (admCd) => {
      expect(priorityRegionTier(admCd)).toBeNull();
    },
  );
});

describe("PRIORITY_REPAYMENT_REGION_CODES", () => {
  it("같은 코드가 두 목록에 들어 있지 않다", () => {
    const all = Object.values(PRIORITY_REPAYMENT_REGION_CODES).flat();
    expect(new Set(all).size).toBe(all.length);
  });

  it("코드는 모두 숫자 2·5·8·10자리다", () => {
    for (const code of Object.values(PRIORITY_REPAYMENT_REGION_CODES).flat()) {
      expect(code).toMatch(/^(\d{2}|\d{5}|\d{8}|\d{10})$/);
    }
  });

  it("코드의 시도는 모두 현행 시도 목록에 있다", () => {
    for (const code of Object.values(PRIORITY_REPAYMENT_REGION_CODES).flat()) {
      expect(SIDO_CODES).toContain(code.slice(0, 2));
    }
  });
});

describe("isCapitalArea", () => {
  it.each(["1168010100", "2823710100", "2871025021", "2815510300", "4139013200", "4183025021"])(
    "%s는 수도권이다",
    (admCd) => {
      expect(isCapitalArea(admCd)).toBe(true);
    },
  );

  it.each(["2635010100", "3611010100", "1230010100", "5111010100", "5011010100"])(
    "%s는 수도권이 아니다",
    (admCd) => {
      expect(isCapitalArea(admCd)).toBe(false);
    },
  );

  it.each(["", "11", "116801010", "11680a0100", "9911010100", "2911010100"])(
    "형식이 잘못됐거나 현행 시도가 아닌 %j는 null이다",
    (admCd) => {
      expect(isCapitalArea(admCd)).toBeNull();
    },
  );
});
