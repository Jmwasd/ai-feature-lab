import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeFetch, type FakeRoute, loadFixture } from "./__fixtures__/load";
import { MissingEnvError } from "../env";
import { type FetchLike, PublicDataError } from "./http";
import { searchAddress } from "./juso";
import { fetchTrades, type RawTrade, type TradeDealKind, type TradeHouseType } from "./molit-trade";
import { buildingKeyOf } from "./trade-keys";

const KEY = "TESTKEY0000000000000000000000000000000000000000000000000000000000==";
const PATHS = {
  APT_SALE: "/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade",
  APT_LEASE: "/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent",
  RH_SALE: "/1613000/RTMSDataSvcRHTrade/getRTMSDataSvcRHTrade",
  RH_LEASE: "/1613000/RTMSDataSvcRHRent/getRTMSDataSvcRHRent",
};

const aptSale = { houseType: "APARTMENT", dealKind: "SALE", lawdCd: "11440", dealYmd: "202408" } as const;
const rhSale = { houseType: "ROW_HOUSE", dealKind: "SALE", lawdCd: "11440", dealYmd: "202408" } as const;
const noDelay = { retryDelayMs: 0 };

function utc(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d));
}

beforeEach(() => {
  vi.stubEnv("DATA_GO_KR_SERVICE_KEY", KEY);
  vi.stubEnv("JUSO_API_KEY", "juso-test-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("fetchTrades 요청", () => {
  it.each<[TradeHouseType, TradeDealKind, string]>([
    ["APARTMENT", "SALE", PATHS.APT_SALE],
    ["APARTMENT", "LEASE", PATHS.APT_LEASE],
    ["ROW_HOUSE", "SALE", PATHS.RH_SALE],
    ["ROW_HOUSE", "LEASE", PATHS.RH_LEASE],
  ])("%s·%s는 해당 오퍼레이션을 부른다", async (houseType, dealKind, path) => {
    const fetch = createFakeFetch({ [path]: "molit/empty.xml" });
    await fetchTrades({ houseType, dealKind, lawdCd: "11440", dealYmd: "202408" }, { fetch });

    expect(fetch.calls).toHaveLength(1);
    const url = fetch.calls[0]!;
    expect(url.origin).toBe("https://apis.data.go.kr");
    expect(url.searchParams.get("serviceKey")).toBe(KEY);
    expect(url.searchParams.get("LAWD_CD")).toBe("11440");
    expect(url.searchParams.get("DEAL_YMD")).toBe("202408");
    expect(url.searchParams.get("pageNo")).toBe("1");
    expect(url.searchParams.get("numOfRows")).toBe("1000");
  });

  it.each([
    { lawdCd: "1144", dealYmd: "202408" },
    { lawdCd: "11440", dealYmd: "2024-08" },
    { lawdCd: "11440", dealYmd: "202413" },
  ])("지역코드·계약월 형식이 틀리면 호출하지 않고 RangeError (%o)", async (input) => {
    const fetch = createFakeFetch({});
    await expect(fetchTrades({ ...aptSale, ...input }, { fetch })).rejects.toThrow(RangeError);
    expect(fetch.calls).toHaveLength(0);
  });

  it("서비스키가 없으면 MissingEnvError", async () => {
    vi.stubEnv("DATA_GO_KR_SERVICE_KEY", "");
    const fetch = createFakeFetch({ [PATHS.APT_SALE]: "molit/empty.xml" });
    await expect(fetchTrades(aptSale, { fetch })).rejects.toThrow(MissingEnvError);
  });
});

describe("fetchTrades 매핑", () => {
  it("아파트 매매: 금액은 만원 정수, 계약일은 UTC 자정", async () => {
    const fetch = createFakeFetch({ [PATHS.APT_SALE]: "molit/apt-trade.xml" });
    const trades = await fetchTrades(aptSale, { fetch });

    expect(trades).toHaveLength(2);
    expect(trades[0]).toEqual<RawTrade>({
      houseType: "APARTMENT",
      dealKind: "SALE",
      lawdCd: "11440",
      dealYmd: "202408",
      umdName: "아현동",
      jibun: "484",
      buildingName: "마포래미안푸르지오",
      exclusiveArea: 84.59,
      floor: 12,
      contractDate: utc(2024, 8, 7),
      priceManwon: 182500,
      depositManwon: null,
      monthlyRentManwon: null,
      cancelled: false,
      cancelledDate: null,
      buildingKey: "11440|아현동|484",
      dedupKey: "APARTMENT|SALE|11440|아현동|2024-08-07|484|마포래미안푸르지오|84.5900|12|182500||",
    });
    expect(trades[1]!.priceManwon).toBe(98000);
    expect(trades[0]!.contractDate.toISOString()).toBe("2024-08-07T00:00:00.000Z");
  });

  it("아파트 전월세: 보증금·월세를 채우고 매매가는 null", async () => {
    const fetch = createFakeFetch({ [PATHS.APT_LEASE]: "molit/apt-rent.xml" });
    const trades = await fetchTrades({ ...aptSale, dealKind: "LEASE" }, { fetch });

    expect(trades).toHaveLength(3);
    expect(trades[0]).toMatchObject({
      houseType: "APARTMENT",
      dealKind: "LEASE",
      umdName: "신공덕동",
      jibun: "167",
      buildingName: "대우메트로디오빌",
      exclusiveArea: 34.39,
      floor: 25,
      contractDate: utc(2024, 8, 15),
      priceManwon: null,
      depositManwon: 1000,
      monthlyRentManwon: 94,
      cancelled: false,
      cancelledDate: null,
    });
    // 전세(월세 0)
    expect(trades[1]).toMatchObject({ depositManwon: 93000, monthlyRentManwon: 0 });
  });

  it("연립다세대 전월세: 건물명은 mhouseNm", async () => {
    const fetch = createFakeFetch({ [PATHS.RH_LEASE]: "molit/rh-rent.xml" });
    const trades = await fetchTrades({ ...rhSale, dealKind: "LEASE" }, { fetch });

    expect(trades).toHaveLength(3);
    expect(trades[0]).toMatchObject({
      houseType: "ROW_HOUSE",
      dealKind: "LEASE",
      umdName: "합정동",
      jibun: "365-14",
      buildingName: "효성센스빌",
      exclusiveArea: 68.87,
      floor: 4,
      depositManwon: 40000,
      monthlyRentManwon: 0,
      buildingKey: "11440|합정동|365-14",
    });
  });

  it("연립다세대 매매: 지하층은 음수, 해제 거래는 버리지 않고 표시한다", async () => {
    const fetch = createFakeFetch({ [PATHS.RH_SALE]: "molit/rh-trade.xml" });
    const trades = await fetchTrades(rhSale, { fetch });

    expect(trades).toHaveLength(2);
    expect(trades[0]).toMatchObject({ jibun: "412-3", priceManwon: 38500, cancelled: false, cancelledDate: null });
    expect(trades[1]).toMatchObject({
      jibun: "412-7",
      buildingName: "망원하이빌",
      floor: -1,
      priceManwon: 45000,
      cancelled: true,
      cancelledDate: utc(2024, 9, 2),
    });
  });

  it("같은 거래의 해제 전후 dedupKey가 같다", async () => {
    const before = await fetchTrades(rhSale, {
      fetch: createFakeFetch({ [PATHS.RH_SALE]: "molit/rh-trade-before-cancel.xml" }),
    });
    const after = await fetchTrades(rhSale, {
      fetch: createFakeFetch({ [PATHS.RH_SALE]: "molit/rh-trade.xml" }),
    });

    expect(before[1]!.cancelled).toBe(false);
    expect(after[1]!.cancelled).toBe(true);
    expect(after.map((t) => t.dedupKey)).toEqual(before.map((t) => t.dedupKey));
  });

  it("단일 항목(배열 아님)도 배열로 돌려준다", async () => {
    const fetch = createFakeFetch({ [PATHS.APT_SALE]: "molit/apt-trade-single.xml" });
    const trades = await fetchTrades({ ...aptSale, lawdCd: "41570" }, { fetch });

    expect(trades).toHaveLength(1);
    expect(trades[0]).toMatchObject({ umdName: "고촌읍 신곡리", jibun: "1040-2", exclusiveArea: 84.9812 });
  });

  it("결과 0건이면 빈 배열", async () => {
    const fetch = createFakeFetch({ [PATHS.APT_SALE]: "molit/empty.xml" });
    await expect(fetchTrades(aptSale, { fetch })).resolves.toEqual([]);
  });

  it("dedupKey는 응답 안에서 거래마다 다르다", async () => {
    const fetch = createFakeFetch({ [PATHS.RH_LEASE]: "molit/rh-rent.xml" });
    const trades = await fetchTrades({ ...rhSale, dealKind: "LEASE" }, { fetch });
    expect(new Set(trades.map((t) => t.dedupKey)).size).toBe(trades.length);
  });
});

describe("fetchTrades 페이지네이션", () => {
  function pagedFetch(pages: Record<string, string>): FetchLike & { pages: string[] } {
    const requested: string[] = [];
    const fake = async (url: string) => {
      const page = new URL(url).searchParams.get("pageNo") ?? "";
      requested.push(page);
      const fixture = pages[page];
      return fixture
        ? new Response(loadFixture(fixture), { status: 200 })
        : new Response("not found", { status: 404 });
    };
    return Object.assign(fake, { pages: requested });
  }

  it("totalCount만큼 모든 페이지를 받아 합친다", async () => {
    const fetch = pagedFetch({ "1": "molit/apt-trade-page-1.xml", "2": "molit/apt-trade-page-2.xml" });
    const trades = await fetchTrades(aptSale, { fetch });

    expect(fetch.pages).toEqual(["1", "2"]);
    expect(trades).toHaveLength(3);
    expect(trades[2]).toMatchObject({ floor: 15, priceManwon: 185000, contractDate: utc(2024, 8, 28) });
  });

  it("한 페이지짜리면 한 번만 부른다", async () => {
    const fetch = pagedFetch({ "1": "molit/apt-trade.xml" });
    await fetchTrades(aptSale, { fetch });
    expect(fetch.pages).toEqual(["1"]);
  });
});

describe("fetchTrades 오류", () => {
  async function errorOf(route: FakeRoute): Promise<PublicDataError> {
    const fetch = createFakeFetch({ [PATHS.APT_SALE]: route });
    const error = await fetchTrades(aptSale, { fetch, ...noDelay }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PublicDataError);
    return error as PublicDataError;
  }

  it("한도 초과 응답(returnReasonCode 22)은 quota", async () => {
    const error = await errorOf("molit/quota-error.xml");
    expect(error.kind).toBe("quota");
    expect(error.source).toBe("molit-trade");
  });

  it("인증 오류 본문(returnReasonCode 30)은 api", async () => {
    const error = await errorOf("molit/auth-error.xml");
    expect(error.kind).toBe("api");
    expect(error.message).toContain("SERVICE_KEY_IS_NOT_REGISTERED_ERROR");
  });

  it("인증 오류가 HTTP 403으로 오면 http 오류, 메시지에 키가 없다", async () => {
    const error = await errorOf({ body: loadFixture("molit/auth-error.xml"), status: 403 });
    expect(error.kind).toBe("http");
    expect(error.status).toBe(403);
    expect(error.message).not.toContain(KEY);
  });

  it("HTTP 429는 quota", async () => {
    const error = await errorOf({ body: "API rate limit exceeded", status: 429 });
    expect(error.kind).toBe("quota");
  });

  it("header.resultCode가 정상이 아니면 api", async () => {
    const body = loadFixture("molit/empty.xml")
      .replace("<resultCode>000</resultCode>", "<resultCode>99</resultCode>")
      .replace("<resultMsg>OK</resultMsg>", "<resultMsg>SERVICE ERROR</resultMsg>");
    const error = await errorOf({ body });
    expect(error.kind).toBe("api");
    expect(error.message).toContain("99");
  });

  it("XML이 아니면 parse", async () => {
    const error = await errorOf({ body: "Unexpected errors" });
    expect(error.kind).toBe("parse");
  });

  it("필수 필드 형식이 틀리면 parse", async () => {
    const body = loadFixture("molit/apt-trade.xml").replace("182,500", "가격미상");
    const error = await errorOf({ body });
    expect(error.kind).toBe("parse");
  });
});

describe("juso 주소와 거래의 buildingKey", () => {
  const JUSO_PATH = "/addrlink/addrLinkApi.do";

  it("일반 지번(망원동 412-3)", async () => {
    const [address] = await searchAddress("월드컵로13길", {
      fetch: createFakeFetch({ [JUSO_PATH]: "juso/general.json" }),
    });
    const trades = await fetchTrades(rhSale, {
      fetch: createFakeFetch({ [PATHS.RH_SALE]: "molit/rh-trade.xml" }),
    });

    expect(buildingKeyOf(address!)).toBe(trades[0]!.buildingKey);
  });

  it("리 단위 주소(고촌읍 신곡리 1040-2)", async () => {
    const [address] = await searchAddress("고촌읍 수기로 21", {
      fetch: createFakeFetch({ [JUSO_PATH]: "juso/ri.json" }),
    });
    const [trade] = await fetchTrades(
      { ...aptSale, lawdCd: "41570" },
      { fetch: createFakeFetch({ [PATHS.APT_SALE]: "molit/apt-trade-single.xml" }) },
    );

    expect(address!.umdName).toBe("고촌읍 신곡리");
    expect(buildingKeyOf(address!)).toBe(trade!.buildingKey);
  });

  it("산 지번: juso는 isMountain을 따로 두므로 그 값으로 '산'을 붙인다", async () => {
    const [address] = await searchAddress("감내2로 203", {
      fetch: createFakeFetch({ [JUSO_PATH]: "juso/mountain.json" }),
    });

    expect(address!.jibun).toBe("10-5");
    expect(buildingKeyOf(address!)).toBe(
      buildingKeyOf({ lawdCd: "26380", umdName: "감천동", jibun: "산10-5", buildingName: null }),
    );
  });

  it("다른 건물(412-3 vs 412-7)은 다른 키", async () => {
    const addresses = await searchAddress("월드컵로13길", {
      fetch: createFakeFetch({ [JUSO_PATH]: "juso/general.json" }),
    });
    const trades = await fetchTrades(rhSale, {
      fetch: createFakeFetch({ [PATHS.RH_SALE]: "molit/rh-trade.xml" }),
    });

    expect(buildingKeyOf(addresses[1]!)).toBe(trades[1]!.buildingKey);
    expect(buildingKeyOf(addresses[0]!)).not.toBe(trades[1]!.buildingKey);
  });
});
