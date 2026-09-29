import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeFetch, loadFixture } from "./__fixtures__/load";
import { MissingEnvError } from "../env";
import {
  type BuildingRecord,
  type BuildingSummary,
  fetchBuildingRecords,
  summarizeBuilding,
} from "./building";
import { type FetchLike, PublicDataError } from "./http";

const KEY = "TESTKEY0000000000000000000000000000000000000000000000000000000000==";
const PATH = "/1613000/BldRgstHubService/getBrTitleInfo";
const noDelay = { retryDelayMs: 0 };

// 서울 강남구 대치동 670 (동부센트레빌), 서울 마포구 망원동 460-8
const daechi = { admCd: "1168010600", isMountain: false, mainNo: 670, subNo: 0 };
const mangwon = { admCd: "1144012300", isMountain: false, mainNo: 460, subNo: 8 };

function utc(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d));
}

beforeEach(() => {
  vi.stubEnv("DATA_GO_KR_SERVICE_KEY", KEY);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("fetchBuildingRecords 요청", () => {
  it("admCd를 시군구 5자리·법정동 5자리로 나누고 번·지를 4자리로 채운다", async () => {
    const fetch = createFakeFetch({ [PATH]: "building/single.xml" });
    await fetchBuildingRecords(mangwon, { fetch });

    expect(fetch.calls).toHaveLength(1);
    const url = fetch.calls[0]!;
    expect(url.origin).toBe("https://apis.data.go.kr");
    expect(url.searchParams.get("serviceKey")).toBe(KEY);
    expect(url.searchParams.get("sigunguCd")).toBe("11440");
    expect(url.searchParams.get("bjdongCd")).toBe("12300");
    expect(url.searchParams.get("platGbCd")).toBe("0");
    expect(url.searchParams.get("bun")).toBe("0460");
    expect(url.searchParams.get("ji")).toBe("0008");
    expect(url.searchParams.get("pageNo")).toBe("1");
    expect(url.searchParams.get("numOfRows")).toBe("100");
  });

  it("산 지번은 platGbCd 1, 부번 없음은 ji 0000", async () => {
    const fetch = createFakeFetch({ [PATH]: "building/empty.xml" });
    await fetchBuildingRecords(
      { admCd: "4157025023", isMountain: true, mainNo: 12, subNo: 0 },
      { fetch },
    );

    const url = fetch.calls[0]!;
    expect(url.searchParams.get("sigunguCd")).toBe("41570");
    expect(url.searchParams.get("bjdongCd")).toBe("25023"); // 리 단위: 읍면 3자리 + 리 2자리
    expect(url.searchParams.get("platGbCd")).toBe("1");
    expect(url.searchParams.get("bun")).toBe("0012");
    expect(url.searchParams.get("ji")).toBe("0000");
  });

  it.each([
    { ...mangwon, admCd: "11440123" },
    { ...mangwon, mainNo: 10000 },
    { ...mangwon, mainNo: 0 },
    { ...mangwon, subNo: -1 },
    { ...mangwon, subNo: 1.5 },
  ])("주소 형식이 틀리면 호출하지 않고 RangeError (%o)", async (address) => {
    const fetch = createFakeFetch({});
    await expect(fetchBuildingRecords(address, { fetch })).rejects.toThrow(RangeError);
    expect(fetch.calls).toHaveLength(0);
  });

  it("서비스키가 없으면 MissingEnvError", async () => {
    vi.stubEnv("DATA_GO_KR_SERVICE_KEY", "");
    const fetch = createFakeFetch({ [PATH]: "building/single.xml" });
    await expect(fetchBuildingRecords(mangwon, { fetch })).rejects.toThrow(MissingEnvError);
  });
});

describe("fetchBuildingRecords 매핑", () => {
  it("단일 동: 주용도·사용승인일(UTC 자정), 빈 동 이름은 null, 위반 여부는 null", async () => {
    const fetch = createFakeFetch({ [PATH]: "building/single.xml" });
    const records = await fetchBuildingRecords(mangwon, { fetch });

    expect(records).toEqual<BuildingRecord[]>([
      {
        mainPurpose: "공동주택",
        isViolation: null,
        useApprovalDate: utc(2020, 10, 30),
        dongName: null,
      },
    ]);
  });

  it("여러 동: 주건축물만 돌려주고 부속건축물(경비실 등)은 뺀다", async () => {
    const fetch = createFakeFetch({ [PATH]: "building/multi-dong.xml" });
    const records = await fetchBuildingRecords(daechi, { fetch });

    expect(records.map((r) => r.dongName)).toEqual(["102동", "상가동", "101동"]);
    expect(records.find((r) => r.dongName === "상가동")?.mainPurpose).toBe("제2종근린생활시설");
    expect(records.every((r) => r.isViolation === null)).toBe(true);
    expect(records.every((r) => r.useApprovalDate?.getTime() === utc(2005, 1, 28).getTime())).toBe(
      true,
    );
  });

  it("사용승인일이 비어 있으면 null", async () => {
    const fetch = createFakeFetch({ [PATH]: "building/no-approval-date.xml" });
    const [record] = await fetchBuildingRecords(mangwon, { fetch });
    expect(record?.useApprovalDate).toBeNull();
    expect(record?.mainPurpose).toBe("공동주택");
  });

  it("결과가 없으면 빈 배열", async () => {
    const fetch = createFakeFetch({ [PATH]: "building/empty.xml" });
    await expect(fetchBuildingRecords(mangwon, { fetch })).resolves.toEqual([]);
  });

  it("사용승인일이 없는 날짜면 null (조회는 실패하지 않는다)", async () => {
    const body = loadFixture("building/single.xml").replace(
      /<useAprDay>\d+<\/useAprDay>/,
      "<useAprDay>19790800</useAprDay>",
    );
    const fetch = createFakeFetch({ [PATH]: { body } });
    const [record] = await fetchBuildingRecords(mangwon, { fetch });
    expect(record?.useApprovalDate).toBeNull();
  });

  it("totalCount가 한 페이지(100건)를 넘으면 모든 페이지를 받아 합친다", async () => {
    const requested: string[] = [];
    const fetch: FetchLike = async (url) => {
      const pageNo = new URL(url).searchParams.get("pageNo") ?? "";
      requested.push(pageNo);
      const body = loadFixture(pageNo === "1" ? "building/multi-dong.xml" : "building/single.xml")
        .replace(/<totalCount>\d+<\/totalCount>/, "<totalCount>150</totalCount>");
      return new Response(body, { status: 200 });
    };

    const records = await fetchBuildingRecords(daechi, { fetch });
    expect(requested).toEqual(["1", "2"]);
    expect(records).toHaveLength(4);
  });
});

describe("fetchBuildingRecords 오류", () => {
  it("인증 오류(게이트웨이 응답)는 api 오류이고 키를 가린다", async () => {
    const fetch = createFakeFetch({ [PATH]: "building/auth-error.xml" });
    const error = await fetchBuildingRecords(mangwon, { fetch }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(PublicDataError);
    expect(error).toMatchObject({ kind: "api", source: "building" });
    expect((error as Error).message).toContain("SERVICE_KEY_IS_NOT_REGISTERED_ERROR");
    expect((error as Error).message).not.toContain(KEY);
  });

  it("한도 초과(returnReasonCode 22)는 quota 오류", async () => {
    const fetch = createFakeFetch({ [PATH]: "building/quota-error.xml" });
    await expect(fetchBuildingRecords(mangwon, { fetch })).rejects.toMatchObject({
      kind: "quota",
      source: "building",
    });
  });

  it("resultCode가 정상이 아니면 api 오류", async () => {
    const body = loadFixture("building/empty.xml").replace(
      "<resultCode>00</resultCode><resultMsg>NORMAL SERVICE</resultMsg>",
      "<resultCode>03</resultCode><resultMsg>NO_DATA</resultMsg>",
    );
    const fetch = createFakeFetch({ [PATH]: { body } });
    await expect(fetchBuildingRecords(mangwon, { fetch })).rejects.toMatchObject({
      kind: "api",
      source: "building",
    });
  });

  it("XML이 아니면 parse 오류", async () => {
    const fetch = createFakeFetch({ [PATH]: { body: "<response><header>" } });
    await expect(fetchBuildingRecords(mangwon, { ...noDelay, fetch })).rejects.toMatchObject({
      kind: "parse",
    });
  });
});

describe("summarizeBuilding", () => {
  const apt101: BuildingRecord = {
    mainPurpose: "공동주택",
    isViolation: null,
    useApprovalDate: utc(2005, 1, 28),
    dongName: "101동",
  };
  const shop: BuildingRecord = {
    mainPurpose: "제2종근린생활시설",
    isViolation: null,
    useApprovalDate: utc(2003, 5, 1),
    dongName: "상가동",
  };
  const apt102: BuildingRecord = {
    mainPurpose: "공동주택",
    isViolation: null,
    useApprovalDate: utc(2010, 3, 15),
    dongName: "102동",
  };

  it("레코드가 없으면 모든 필드 null", () => {
    expect(summarizeBuilding([], "101동")).toEqual<BuildingSummary>({
      mainPurpose: null,
      isViolation: null,
      useApprovalDate: null,
    });
  });

  it("동 이름이 일치하는 레코드를 쓴다(표기 차이는 정규화)", () => {
    const records = [apt101, shop, apt102];
    expect(summarizeBuilding(records, "101")).toEqual<BuildingSummary>({
      mainPurpose: "공동주택",
      isViolation: null,
      useApprovalDate: utc(2005, 1, 28),
    });
    expect(summarizeBuilding(records, "제 102 동").useApprovalDate).toEqual(utc(2010, 3, 15));
  });

  it("동이 없거나 일치하지 않으면 보수적으로 합친다: 비주거 용도, 가장 최근 사용승인일", () => {
    const records = [apt101, shop, apt102];
    const expected: BuildingSummary = {
      mainPurpose: "제2종근린생활시설",
      isViolation: null,
      useApprovalDate: utc(2010, 3, 15),
    };
    expect(summarizeBuilding(records, null)).toEqual(expected);
    expect(summarizeBuilding(records, "999동")).toEqual(expected);
  });

  it("모두 주거용이면 첫 주용도를 쓴다", () => {
    expect(summarizeBuilding([apt101, apt102], null).mainPurpose).toBe("공동주택");
  });

  it("주용도가 모두 비어 있으면 null", () => {
    const blank = { ...apt101, mainPurpose: null };
    expect(summarizeBuilding([blank, { ...blank, dongName: "102동" }], null).mainPurpose).toBeNull();
  });

  it("위반은 하나라도 true면 true, 모두 false면 false, 하나라도 모르면 null", () => {
    const t = { ...apt101, isViolation: true };
    const f = { ...apt102, isViolation: false };
    const n = { ...shop, isViolation: null };
    expect(summarizeBuilding([f, t, n], null).isViolation).toBe(true);
    expect(summarizeBuilding([f, { ...f, dongName: "103동" }], null).isViolation).toBe(false);
    expect(summarizeBuilding([f, n], null).isViolation).toBeNull();
  });

  it("사용승인일이 일부 비어 있으면 있는 값 중 가장 최근, 모두 비면 null", () => {
    const noDate = { ...apt102, useApprovalDate: null };
    expect(summarizeBuilding([apt101, noDate], null).useApprovalDate).toEqual(utc(2005, 1, 28));
    expect(summarizeBuilding([noDate], null).useApprovalDate).toBeNull();
  });
});
