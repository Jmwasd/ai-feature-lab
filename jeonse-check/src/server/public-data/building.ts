import "server-only";

import { RESIDENTIAL_MAIN_PURPOSES } from "@/consts/policy";

import { requireEnv } from "../env";
import { fetchAllItems, readField, utcDate } from "./data-go-kr";
import { type HttpOptions } from "./http";
import { normalizeDong } from "./official-price";

// 국토교통부 건축HUB 건축물대장정보 서비스(apis.data.go.kr/1613000/BldRgstHubService) 어댑터.
// 표제부(getBrTitleInfo)로 동별 주용도·사용승인일을 받는다. 원본 필드명(mainPurpsCdNm 등)은 이 파일 밖으로 내보내지 않는다.
//
// 위반건축물 여부 미제공: isViolation은 항상 null이다. false로 채우지 않는다("위반 아님"으로 읽혀 위험을 가린다).
// 근거: 2026-09-30 이 서비스의 오퍼레이션 10개(getBrTitleInfo·getBrRecapTitleInfo·getBrBasisOulnInfo·getBrFlrOulnInfo·
//       getBrAtchJibunInfo·getBrExposPubuseAreaInfo·getBrWclfInfo·getBrHsprcInfo·getBrExposInfo·getBrJijiguInfo)를
//       실제로 호출해 응답 필드를 모두 확인했으나 위반건축물 여부 필드는 없었다.
//       위반건축물 표시는 세움터에서 발급하는 건축물대장 표제부 문서에만 있다.
const ENDPOINT = "https://apis.data.go.kr/1613000/BldRgstHubService/getBrTitleInfo";

// 한 페이지 크기. 이 서비스는 numOfRows를 100보다 크게 줘도 100건만 돌려준다.
const PAGE_SIZE = 100;

// 대지구분코드. 명세: 0 대지, 1 산, 2 블록.
const PLAT_GB_LAND = "0";
const PLAT_GB_MOUNTAIN = "1";
// 주부속구분코드. 부속건축물(경비실·주차장 등)은 임차인이 사는 건물이 아니고,
// 합치기에서 비주거 용도 신호를 잘못 만들 수 있어 뺀다.
const ATTACHED_BUILDING = "1";

export interface BuildingRecord {
  mainPurpose: string | null; // 주용도명
  isViolation: boolean | null; // 위반건축물 여부. 이 API는 제공하지 않아 항상 null
  useApprovalDate: Date | null; // 사용승인일
  dongName: string | null; // 동 이름. 없으면 null
}

// src/features/judgment/types.ts의 BuildingInfo와 구조가 같다.
export interface BuildingSummary {
  mainPurpose: string | null;
  isViolation: boolean | null;
  useApprovalDate: Date | null;
}

export interface BuildingAddress {
  admCd: string; // 법정동코드 10자리
  isMountain: boolean;
  mainNo: number; // 본번
  subNo: number; // 부번(없으면 0)
}

/**
 * 한 필지(지번)의 표제부 레코드를 모든 페이지에 걸쳐 받는다. 주건축물만 돌려준다.
 * 결과가 없으면 빈 배열이다.
 */
export async function fetchBuildingRecords(
  address: BuildingAddress,
  options: HttpOptions = {},
): Promise<BuildingRecord[]> {
  const { admCd, isMountain, mainNo, subNo } = address;
  if (!/^\d{10}$/.test(admCd)) {
    throw new RangeError(`법정동코드는 숫자 10자리여야 한다: ${admCd}`);
  }
  const bun = pad4(mainNo, "본번", 1);
  const ji = pad4(subNo, "부번", 0);

  const serviceKey = requireEnv("DATA_GO_KR_SERVICE_KEY");
  const pageUrl = (pageNo: number): URL => {
    const url = new URL(ENDPOINT);
    url.searchParams.set("serviceKey", serviceKey);
    url.searchParams.set("sigunguCd", admCd.slice(0, 5));
    url.searchParams.set("bjdongCd", admCd.slice(5));
    url.searchParams.set("platGbCd", isMountain ? PLAT_GB_MOUNTAIN : PLAT_GB_LAND);
    url.searchParams.set("bun", bun);
    url.searchParams.set("ji", ji);
    url.searchParams.set("pageNo", String(pageNo));
    url.searchParams.set("numOfRows", String(PAGE_SIZE));
    return url;
  };

  const items = await fetchAllItems(pageUrl, PAGE_SIZE, "building", options);
  return items
    .map(({ item }) => item)
    .filter((item) => readField(item, "mainAtchGbCd") !== ATTACHED_BUILDING)
    .map(toRecord);
}

/**
 * 필지의 레코드를 판정용 요약 하나로 줄인다.
 * 동 이름이 일치하는 레코드가 있으면 그 레코드를 쓰고, 없으면 보수적으로 합친다.
 * 신호를 놓치는 쪽보다 확인을 권하는 쪽이 낫기 때문이다.
 */
export function summarizeBuilding(records: BuildingRecord[], dong: string | null): BuildingSummary {
  if (dong !== null && dong.trim() !== "") {
    const target = normalizeDong(dong);
    const match = records.find((r) => r.dongName !== null && normalizeDong(r.dongName) === target);
    if (match) {
      return {
        mainPurpose: match.mainPurpose,
        isViolation: match.isViolation,
        useApprovalDate: match.useApprovalDate,
      };
    }
  }

  // 주거용이 아닌 주용도가 하나라도 있으면 그 용도, 없으면 첫 주용도.
  const purposes = records.map((r) => r.mainPurpose).filter((p): p is string => p !== null);
  const mainPurpose =
    purposes.find((p) => !RESIDENTIAL_MAIN_PURPOSES.some((r) => p.includes(r))) ??
    purposes[0] ??
    null;

  // 위반은 하나라도 true면 true. 모르는 레코드가 있으면 false라고 단정하지 않는다.
  const violations = records.map((r) => r.isViolation);
  const isViolation =
    records.length === 0
      ? null
      : violations.includes(true)
        ? true
        : violations.includes(null)
          ? null
          : false;

  // 사용승인일은 가장 최근 값(신축 신호를 놓치지 않는다).
  const useApprovalDate = records.reduce<Date | null>((latest, r) => {
    const date = r.useApprovalDate;
    return date && (!latest || date.getTime() > latest.getTime()) ? date : latest;
  }, null);

  return { mainPurpose, isViolation, useApprovalDate };
}

function toRecord(item: Record<string, unknown>): BuildingRecord {
  const purpose = readField(item, "mainPurpsCdNm");
  const dong = readField(item, "dongNm");
  return {
    mainPurpose: purpose === "" ? null : purpose,
    isViolation: null,
    // 오래된 대장에는 일자가 "00"인 값 같은 불완전한 날짜가 있다. 한 동 때문에 필지 전체 조회를 실패시키지 않고 모르는 값(null)으로 둔다.
    useApprovalDate: parseDay(readField(item, "useAprDay")),
    dongName: dong === "" ? null : dong,
  };
}

// "20210315" → UTC 자정. 빈 값, 형식이 틀리거나 없는 날짜(2월 30일 등)는 null.
function parseDay(text: string): Date | null {
  const match = /^(\d{4})(\d{2})(\d{2})$/.exec(text);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number) as [number, number, number];
  return utcDate(year, month, day);
}

function pad4(value: number, label: string, min: number): string {
  if (!Number.isInteger(value) || value < min || value > 9999) {
    throw new RangeError(`${label}은 ${min}~9999 정수여야 한다: ${value}`);
  }
  return String(value).padStart(4, "0");
}
