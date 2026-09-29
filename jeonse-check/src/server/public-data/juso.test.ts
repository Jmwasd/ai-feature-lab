import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeFetch, type FakeRoute, loadFixture } from "./__fixtures__/load";
import { MissingEnvError } from "../env";
import { PublicDataError } from "./http";
import { buildPnu, formatJibun, type NormalizedAddress, searchAddress } from "./juso";

const JUSO_PATH = "/addrlink/addrLinkApi.do";
const KEY = "devU01TX0FVVEgyMDI2MDkzMDAwMDAwMDA=";

function fakeJuso(route: FakeRoute) {
  return createFakeFetch({ [JUSO_PATH]: route });
}

function jsonBody(errorCode: string, errorMessage: string): FakeRoute {
  return {
    body: JSON.stringify({
      results: {
        common: { errorCode, errorMessage, totalCount: "0", currentPage: "1", countPerPage: "10" },
        juso: null,
      },
    }),
  };
}

const noDelay = { retryDelayMs: 0 };

beforeEach(() => {
  vi.stubEnv("JUSO_API_KEY", KEY);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("formatJibun", () => {
  it("부번이 있으면 본번-부번", () => {
    expect(formatJibun(412, 3)).toBe("412-3");
  });

  it("부번이 0이면 본번만", () => {
    expect(formatJibun(737, 0)).toBe("737");
  });
});

describe("buildPnu", () => {
  it("법정동코드 10 + 산구분 1 + 본번 4 + 부번 4 = 19자리", () => {
    const pnu = buildPnu({ admCd: "1144012300", isMountain: false, mainNo: 412, subNo: 3 });
    expect(pnu).toBe("1144012300" + "1" + "0412" + "0003");
    expect(pnu).toHaveLength(19);
  });

  it("산이면 산구분이 2다", () => {
    expect(buildPnu({ admCd: "2638010600", isMountain: true, mainNo: 10, subNo: 5 })).toBe(
      "2638010600200100005",
    );
  });

  it("부번이 없으면 0000", () => {
    expect(buildPnu({ admCd: "1168010100", isMountain: false, mainNo: 737, subNo: 0 })).toBe(
      "1168010100107370000",
    );
  });

  it.each([
    { admCd: "11440123", isMountain: false, mainNo: 1, subNo: 0 },
    { admCd: "1144012300", isMountain: false, mainNo: 10000, subNo: 0 },
    { admCd: "1144012300", isMountain: false, mainNo: 1, subNo: -1 },
    { admCd: "1144012300", isMountain: false, mainNo: 1.5, subNo: 0 },
  ])("자릿수를 넘거나 형식이 틀리면 RangeError (%o)", (input) => {
    expect(() => buildPnu(input)).toThrow(RangeError);
  });
});

describe("searchAddress", () => {
  it("일반 지번 주소를 도메인 타입으로 매핑한다", async () => {
    const fetch = fakeJuso("juso/general.json");
    const result = await searchAddress("월드컵로13길", { fetch });

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual<NormalizedAddress>({
      id: "1144012300104120003000001",
      roadAddress: "서울특별시 마포구 월드컵로13길 15 (망원동)",
      jibunAddress: "서울특별시 마포구 망원동 412-3",
      buildingName: null,
      admCd: "1144012300",
      lawdCd: "11440",
      sidoName: "서울특별시",
      sigunguName: "마포구",
      umdName: "망원동",
      isMountain: false,
      mainNo: 412,
      subNo: 3,
      jibun: "412-3",
      pnu: "1144012300104120003",
    });
    expect(result[1]!.buildingName).toBe("망원하이빌");
  });

  it("원본 응답 필드명을 내보내지 않는다", async () => {
    const [first] = await searchAddress("월드컵로13길", { fetch: fakeJuso("juso/general.json") });
    expect(Object.keys(first!).sort()).toEqual(
      [
        "id",
        "roadAddress",
        "jibunAddress",
        "buildingName",
        "admCd",
        "lawdCd",
        "sidoName",
        "sigunguName",
        "umdName",
        "isMountain",
        "mainNo",
        "subNo",
        "jibun",
        "pnu",
      ].sort(),
    );
  });

  it("산 지번은 isMountain과 PNU 산구분 2로 표시한다", async () => {
    const [address] = await searchAddress("감내2로 203", { fetch: fakeJuso("juso/mountain.json") });
    expect(address!.isMountain).toBe(true);
    expect(address!.jibun).toBe("10-5");
    expect(address!.pnu).toBe("2638010600200100005");
    expect(address!.lawdCd).toBe("26380");
  });

  it("부번이 없으면 subNo 0, jibun은 본번만", async () => {
    const [address] = await searchAddress("테헤란로 152", { fetch: fakeJuso("juso/no-sub-number.json") });
    expect(address!.subNo).toBe(0);
    expect(address!.jibun).toBe("737");
    expect(address!.pnu).toBe("1168010100107370000");
    expect(address!.buildingName).toBe("강남파이낸스센터");
  });

  it("리가 있으면 umdName은 '읍면 리'", async () => {
    const [address] = await searchAddress("고촌읍 수기로 21", { fetch: fakeJuso("juso/ri.json") });
    expect(address!.umdName).toBe("고촌읍 신곡리");
    expect(address!.sidoName).toBe("경기도");
    expect(address!.sigunguName).toBe("김포시");
    expect(address!.lawdCd).toBe("41570");
    expect(address!.pnu).toBe("4157025021110400002");
  });

  it("결과가 없으면 빈 배열", async () => {
    expect(await searchAddress("없는주소길 999", { fetch: fakeJuso("juso/empty.json") })).toEqual([]);
  });

  it("요청 파라미터를 명세대로 보낸다", async () => {
    const fetch = fakeJuso("juso/empty.json");
    await searchAddress("  월드컵로13길 15  ", { fetch, page: 2, perPage: 20 });

    expect(fetch.calls).toHaveLength(1);
    const url = fetch.calls[0]!;
    expect(url.origin).toBe("https://business.juso.go.kr");
    expect(url.searchParams.get("confmKey")).toBe(KEY);
    expect(url.searchParams.get("keyword")).toBe("월드컵로13길 15");
    expect(url.searchParams.get("resultType")).toBe("json");
    expect(url.searchParams.get("currentPage")).toBe("2");
    expect(url.searchParams.get("countPerPage")).toBe("20");
  });

  it("기본 페이지는 1, 페이지당 10건", async () => {
    const fetch = fakeJuso("juso/empty.json");
    await searchAddress("월드컵로", { fetch });
    expect(fetch.calls[0]!.searchParams.get("currentPage")).toBe("1");
    expect(fetch.calls[0]!.searchParams.get("countPerPage")).toBe("10");
  });

  it("검색 금지 특수문자(%=><[])는 지우고 보낸다", async () => {
    const fetch = fakeJuso("juso/empty.json");
    await searchAddress("월드컵로[13]길%", { fetch });
    expect(fetch.calls[0]!.searchParams.get("keyword")).toBe("월드컵로13길");
  });

  it.each(["", "   ", "망", " 망 ", "!!@@##", "12345", "[%]"])(
    "검색어 '%s'는 호출하지 않고 빈 배열",
    async (keyword) => {
      const fetch = fakeJuso("juso/general.json");
      expect(await searchAddress(keyword, { fetch })).toEqual([]);
      expect(fetch.calls).toHaveLength(0);
    },
  );

  it("검색어가 부족하면 키가 없어도 호출하지 않는다", async () => {
    vi.stubEnv("JUSO_API_KEY", "");
    const fetch = fakeJuso("juso/general.json");
    expect(await searchAddress("망", { fetch })).toEqual([]);
  });

  it("키가 없으면 MissingEnvError", async () => {
    vi.stubEnv("JUSO_API_KEY", "");
    await expect(searchAddress("월드컵로", { fetch: fakeJuso("juso/general.json") })).rejects.toThrow(
      MissingEnvError,
    );
  });

  it("오류 코드 응답은 PublicDataError(api)로 바꾸고 키를 싣지 않는다", async () => {
    const error = await searchAddress("월드컵로", { fetch: fakeJuso("juso/error.json") }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(PublicDataError);
    const e = error as PublicDataError;
    expect(e.kind).toBe("api");
    expect(e.source).toBe("juso");
    expect(e.message).toContain("E0001");
    expect(`${e.message} ${e.url ?? ""}`).not.toContain(KEY);
    expect(`${e.message} ${e.url ?? ""}`).not.toContain(encodeURIComponent(KEY));
  });

  it.each([
    ["-999", "시스템 에러입니다."],
    ["E0014", "개발승인키 기간이 만료되어 서비스를 이용하실 수 없습니다."],
  ])("시스템·키 오류(%s)는 api 오류", async (code, message) => {
    await expect(
      searchAddress("월드컵로", { fetch: fakeJuso(jsonBody(code, message)) }),
    ).rejects.toMatchObject({ kind: "api", source: "juso" });
  });

  it.each([
    ["E0005", "검색어가 입력되지 않았습니다."],
    ["E0006", "주소를 상세히 입력해 주시기 바랍니다."],
    ["E0008", "검색어는 두글자 이상 입력되어야 합니다."],
    ["E0009", "검색어는 문자와 숫자 같이 입력되어야 합니다."],
    ["E0012", "특수문자+숫자만으로는 검색이 불가능 합니다."],
    ["E0013", "SQL 예약어 또는 특수문자( %,=,>,<,[,] )는 검색이 불가능 합니다."],
    ["E0015", "검색 범위를 초과하였습니다."],
  ])("검색어 관련 코드(%s)는 오류가 아니라 빈 배열", async (code, message) => {
    expect(await searchAddress("서울특별시", { fetch: fakeJuso(jsonBody(code, message)) })).toEqual([]);
  });

  it("응답 구조가 명세와 다르면 parse 오류", async () => {
    await expect(
      searchAddress("월드컵로", { fetch: fakeJuso({ body: JSON.stringify({ foo: 1 }) }) }),
    ).rejects.toMatchObject({ kind: "parse", source: "juso" });
  });

  it("법정동코드가 10자리가 아니면 parse 오류", async () => {
    const raw = JSON.parse(loadFixture("juso/general.json"));
    raw.results.juso[0].admCd = "11440";
    await expect(
      searchAddress("월드컵로", { fetch: fakeJuso({ body: JSON.stringify(raw) }) }),
    ).rejects.toMatchObject({ kind: "parse", source: "juso" });
  });

  it("5xx면 http 오류(재시도 후)", async () => {
    const fetch = fakeJuso({ body: "down", status: 503 });
    await expect(searchAddress("월드컵로", { fetch, ...noDelay, retries: 1 })).rejects.toMatchObject({
      kind: "http",
    });
    expect(fetch.calls).toHaveLength(2);
  });

  it.each([{ page: 0 }, { perPage: 0 }, { perPage: 101 }, { page: 1.5 }])(
    "페이지 옵션이 범위를 벗어나면 RangeError (%o)",
    async (options) => {
      await expect(searchAddress("월드컵로", { fetch: fakeJuso("juso/empty.json"), ...options })).rejects.toThrow(
        RangeError,
      );
    },
  );
});
