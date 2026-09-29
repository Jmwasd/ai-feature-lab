import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadFixture } from "./__fixtures__/load";
import { MissingEnvError } from "../env";
import { type FetchLike, PublicDataError } from "./http";
import {
  fetchOfficialPrice,
  normalizeDong,
  normalizeHo,
  type OfficialPrice,
} from "./official-price";

const KEY = "TEST-VWORLD-KEY-0000-000000000000";
const DOMAIN = "http://localhost:3000";
const PATH = "/ned/data/getApartHousingPriceAttr";

// 은마(대치동 316)와 망원동 454-13·460-14 다세대. fixture는 2026-09-30 실제 응답을 줄인 것이다.
const APT_PNU = "1168010600103160000";
const RH_PNU = "1144012300104600014";
const SINGLE_PNU = "1144012300104540013";
const AS_OF = new Date("2026-09-30T00:00:00+09:00");
const noDelay = { retryDelayMs: 0 };

type Route = string | { body: string; status?: number };
type YearFetch = FetchLike & { calls: URL[] };

// stdrYear·pageNo별 응답을 돌려주는 가짜 fetch. 키는 "2026" 또는 "2026:2"(연도:페이지)다. 없는 연도는 빈 결과다.
function yearFetch(routes: Record<string, Route>): YearFetch {
  const calls: URL[] = [];
  const fake = async (url: string): Promise<Response> => {
    const parsed = new URL(url);
    calls.push(parsed);
    if (parsed.pathname !== PATH) return new Response("not found", { status: 404 });
    const year = parsed.searchParams.get("stdrYear") ?? "";
    const page = parsed.searchParams.get("pageNo") ?? "1";
    const route = routes[`${year}:${page}`] ?? (page === "1" ? routes[year] : undefined) ?? "vworld/empty.json";
    if (typeof route === "string") return new Response(loadFixture(route), { status: 200 });
    return new Response(route.body, { status: route.status ?? 200 });
  };
  return Object.assign(fake, { calls });
}

function row(overrides: Record<string, string>): Record<string, string> {
  return {
    stdrYear: "2026",
    prvuseAr: "84.43",
    pblntfPc: "2702000000",
    pnu: APT_PNU,
    dongNm: "28",
    hoNm: "1207",
    lastUpdtDt: "2026-05-14",
    stdrMt: "01",
    ...overrides,
  };
}

function body(rows: Record<string, string>[]): { body: string } {
  return {
    body: JSON.stringify({
      apartHousingPrices: {
        field: rows,
        pageNo: "1",
        resultCode: "",
        totalCount: String(rows.length),
        numOfRows: "1000",
        resultMsg: "",
      },
    }),
  };
}

beforeEach(() => {
  vi.stubEnv("VWORLD_API_KEY", KEY);
  vi.stubEnv("VWORLD_API_DOMAIN", DOMAIN);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("normalizeDong", () => {
  it.each([
    ["101동", "101"],
    ["101", "101"],
    ["0101", "101"],
    ["제101동", "101"],
    [" 101 동 ", "101"],
    ["a동", "A"],
    ["A", "A"],
    ["가동", "가"],
    ["에이", "에이"],
    ["에이스빌라", "에이스빌라"],
    ["", ""],
  ])("%j → %j", (input, expected) => {
    expect(normalizeDong(input)).toBe(expected);
  });
});

describe("normalizeHo", () => {
  it.each([
    ["1001호", "1001"],
    ["1001", "1001"],
    ["0101", "101"],
    ["제101호", "101"],
    [" 1001 호 ", "1001"],
    ["지하101", "B101"],
    ["지하 101호", "B101"],
    ["지층101", "B101"],
    ["B01", "B1"],
    ["b101호", "B101"],
    ["지층1", "B1"],
    ["이층", "이층"],
    ["", ""],
  ])("%j → %j", (input, expected) => {
    expect(normalizeHo(input)).toBe(expected);
  });
});

describe("fetchOfficialPrice 요청", () => {
  it("당해 연도·숫자 호로 조회하고 동은 필터로 보내지 않는다", async () => {
    const fetch = yearFetch({ "2026": "vworld/apt-ho-2026.json" });
    await fetchOfficialPrice({ pnu: APT_PNU, dong: "28동", ho: "1207호", asOf: AS_OF }, { fetch });

    expect(fetch.calls).toHaveLength(1);
    const url = fetch.calls[0]!;
    expect(url.origin).toBe("https://api.vworld.kr");
    expect(url.pathname).toBe(PATH);
    expect(url.searchParams.get("key")).toBe(KEY);
    expect(url.searchParams.get("domain")).toBe(DOMAIN);
    expect(url.searchParams.get("pnu")).toBe(APT_PNU);
    expect(url.searchParams.get("stdrYear")).toBe("2026");
    expect(url.searchParams.get("format")).toBe("json");
    expect(url.searchParams.get("numOfRows")).toBe("1000");
    expect(url.searchParams.get("pageNo")).toBe("1");
    expect(url.searchParams.get("hoNm")).toBe("1207");
    expect(url.searchParams.has("dongNm")).toBe(false);
  });

  it("지하 호처럼 숫자가 아닌 호는 표기가 제각각이라 호 필터 없이 전체를 받는다", async () => {
    const fetch = yearFetch({ "2026": "vworld/rowhouse-2026.json" });
    await fetchOfficialPrice({ pnu: RH_PNU, dong: "에이", ho: "지하101호", asOf: AS_OF }, { fetch });

    expect(fetch.calls[0]!.searchParams.has("hoNm")).toBe(false);
  });

  it("기준연도는 한국 시간으로 정한다", async () => {
    const fetch = yearFetch({ "2026": "vworld/apt-ho-2026.json" });
    // UTC로는 2025-12-31, 한국 시간으로는 2026-01-01이다.
    const asOf = new Date("2025-12-31T16:00:00Z");
    await fetchOfficialPrice({ pnu: APT_PNU, dong: "28", ho: "1207", asOf }, { fetch });

    expect(fetch.calls[0]!.searchParams.get("stdrYear")).toBe("2026");
  });

  it.each([
    { pnu: "116801060010316", ho: "1207" },
    { pnu: "116801060010316000A", ho: "1207" },
    { pnu: APT_PNU, ho: "  호 " },
  ])("PNU가 19자리 숫자가 아니거나 호가 비면 호출하지 않고 RangeError (%o)", async (input) => {
    const fetch = yearFetch({});
    await expect(
      fetchOfficialPrice({ dong: null, asOf: AS_OF, ...input }, { fetch }),
    ).rejects.toThrow(RangeError);
    expect(fetch.calls).toHaveLength(0);
  });

  it("asOf가 유효한 날짜가 아니면 RangeError", async () => {
    const fetch = yearFetch({});
    await expect(
      fetchOfficialPrice({ pnu: APT_PNU, dong: null, ho: "1207", asOf: new Date("x") }, { fetch }),
    ).rejects.toThrow(RangeError);
  });

  it.each(["VWORLD_API_KEY", "VWORLD_API_DOMAIN"])("%s가 없으면 MissingEnvError", async (name) => {
    vi.stubEnv(name, "");
    const fetch = yearFetch({ "2026": "vworld/apt-ho-2026.json" });
    await expect(
      fetchOfficialPrice({ pnu: APT_PNU, dong: "28", ho: "1207", asOf: AS_OF }, { fetch }),
    ).rejects.toThrow(MissingEnvError);
  });
});

describe("fetchOfficialPrice 매핑", () => {
  it("동·호가 맞는 세대의 공시가격을 원 단위로 돌려준다", async () => {
    const fetch = yearFetch({ "2026": "vworld/apt-ho-2026.json" });
    const price = await fetchOfficialPrice(
      { pnu: APT_PNU, dong: "제28동", ho: "1207호", asOf: AS_OF },
      { fetch },
    );

    expect(price).toEqual<OfficialPrice>({
      price: 2_702_000_000,
      baseYear: 2026,
      dongName: "28",
      hoName: "1207",
      exclusiveArea: 84.43,
    });
  });

  it("같은 호라도 동이 다르면 그 동의 값을 쓴다", async () => {
    const fetch = yearFetch({ "2026": "vworld/apt-ho-2026.json" });
    const price = await fetchOfficialPrice(
      { pnu: APT_PNU, dong: "1", ho: "1207", asOf: AS_OF },
      { fetch },
    );

    expect(price).toMatchObject({ price: 2_379_000_000, dongName: "1", exclusiveArea: 76.79 });
  });

  it("다세대 지하 호: '지하 101호'가 응답의 '지하101'과 맞는다", async () => {
    const fetch = yearFetch({ "2026": "vworld/rowhouse-2026.json" });
    const price = await fetchOfficialPrice(
      { pnu: RH_PNU, dong: "에이동", ho: "지하 101호", asOf: AS_OF },
      { fetch },
    );

    expect(price).toEqual<OfficialPrice>({
      price: 203_000_000,
      baseYear: 2026,
      dongName: "에이",
      hoName: "지하101",
      exclusiveArea: 35.52,
    });
  });

  it("동 없는 단일 건물: 동이 null이면 호만으로 찾고 동 이름은 null", async () => {
    const fetch = yearFetch({ "2026": "vworld/single-2026.json" });
    const price = await fetchOfficialPrice(
      { pnu: SINGLE_PNU, dong: null, ho: "301호", asOf: AS_OF },
      { fetch },
    );

    expect(price).toEqual<OfficialPrice>({
      price: 188_000_000,
      baseYear: 2026,
      dongName: null,
      hoName: "301",
      exclusiveArea: 31.44,
    });
  });

  it("응답에 동이 없는 건물은 사용자가 동을 적어도 호만으로 찾는다", async () => {
    const fetch = yearFetch({ "2026": "vworld/single-2026.json" });
    const price = await fetchOfficialPrice(
      { pnu: SINGLE_PNU, dong: "1동", ho: "301", asOf: AS_OF },
      { fetch },
    );

    expect(price).toMatchObject({ price: 188_000_000, dongName: null });
  });

  it("같은 세대가 중복으로 오면 최종 갱신일이 늦은 행을 쓴다", async () => {
    const fetch = yearFetch({
      "2026": body([
        row({ pblntfPc: "2700000000", lastUpdtDt: "2026-04-30" }),
        row({ pblntfPc: "2702000000", lastUpdtDt: "2026-05-14" }),
        row({ pblntfPc: "2700000000", lastUpdtDt: "2026-04-30" }),
      ]),
    });
    const price = await fetchOfficialPrice(
      { pnu: APT_PNU, dong: "28", ho: "1207", asOf: AS_OF },
      { fetch },
    );

    expect(price?.price).toBe(2_702_000_000);
  });

  it("전용면적이 비어 있으면 exclusiveArea는 null", async () => {
    const fetch = yearFetch({ "2026": body([row({ prvuseAr: "" })]) });
    const price = await fetchOfficialPrice(
      { pnu: APT_PNU, dong: "28", ho: "1207", asOf: AS_OF },
      { fetch },
    );

    expect(price?.exclusiveArea).toBeNull();
  });
});

describe("fetchOfficialPrice 연도 폴백", () => {
  it("당해 연도 결과가 없으면 전년도 값을 쓴다(공시 발표 전)", async () => {
    const fetch = yearFetch({ "2025": "vworld/apt-ho-2025.json" });
    const price = await fetchOfficialPrice(
      { pnu: APT_PNU, dong: "28", ho: "1207", asOf: AS_OF },
      { fetch },
    );

    expect(fetch.calls.map((url) => url.searchParams.get("stdrYear"))).toEqual(["2026", "2025"]);
    expect(price).toEqual<OfficialPrice>({
      price: 2_063_000_000,
      baseYear: 2025,
      dongName: "28",
      hoName: "1207",
      exclusiveArea: 84.43,
    });
  });

  it("두 해 모두 없으면 null", async () => {
    const fetch = yearFetch({});
    const price = await fetchOfficialPrice(
      { pnu: APT_PNU, dong: "28", ho: "1207", asOf: AS_OF },
      { fetch },
    );

    expect(price).toBeNull();
    expect(fetch.calls).toHaveLength(2);
  });

  it("당해 연도에 세대가 있으면 전년도를 조회하지 않는다", async () => {
    const fetch = yearFetch({
      "2026": "vworld/apt-ho-2026.json",
      "2025": "vworld/apt-ho-2025.json",
    });
    const price = await fetchOfficialPrice(
      { pnu: APT_PNU, dong: "28", ho: "1207", asOf: AS_OF },
      { fetch },
    );

    expect(price?.baseYear).toBe(2026);
    expect(fetch.calls).toHaveLength(1);
  });

  it("전체 조회는 totalCount 기준으로 모든 페이지를 받는다", async () => {
    const fetch = yearFetch({
      "2026:1": "vworld/rowhouse-2026-page-1.json",
      "2026:2": "vworld/rowhouse-2026-page-2.json",
    });
    const price = await fetchOfficialPrice(
      { pnu: RH_PNU, dong: "에이", ho: "지하102", asOf: AS_OF },
      { fetch },
    );

    expect(fetch.calls.map((url) => url.searchParams.get("pageNo"))).toEqual(["1", "2"]);
    expect(price).toMatchObject({ price: 210_000_000, hoName: "지하102", dongName: "에이" });
  });
});

describe("fetchOfficialPrice 다른 세대로 대신하지 않는다", () => {
  it("동이 null인데 같은 호가 여러 동에 있으면 null이고 전년도로 넘어가지 않는다", async () => {
    const fetch = yearFetch({
      "2026": "vworld/apt-ho-2026.json",
      "2025": "vworld/apt-ho-2025.json",
    });
    const price = await fetchOfficialPrice(
      { pnu: APT_PNU, dong: null, ho: "1207", asOf: AS_OF },
      { fetch },
    );

    expect(price).toBeNull();
    expect(fetch.calls).toHaveLength(1);
  });

  it("동이 맞지 않으면 같은 건물의 다른 동 값을 쓰지 않는다", async () => {
    const fetch = yearFetch({
      "2026": "vworld/apt-ho-2026.json",
      "2025": "vworld/apt-ho-2025.json",
    });
    const price = await fetchOfficialPrice(
      { pnu: APT_PNU, dong: "4동", ho: "1207", asOf: AS_OF },
      { fetch },
    );

    expect(price).toBeNull();
  });

  it("'A동'은 응답의 '에이'와 다른 동으로 본다", async () => {
    const fetch = yearFetch({
      "2026": "vworld/rowhouse-2026.json",
      "2025": "vworld/rowhouse-2026.json",
    });
    const price = await fetchOfficialPrice(
      { pnu: RH_PNU, dong: "A동", ho: "101", asOf: AS_OF },
      { fetch },
    );

    expect(price).toBeNull();
  });

  it("호가 없으면 null", async () => {
    const fetch = yearFetch({
      "2026": "vworld/rowhouse-2026.json",
      "2025": "vworld/rowhouse-2026.json",
    });
    const price = await fetchOfficialPrice(
      { pnu: RH_PNU, dong: "에이", ho: "301", asOf: AS_OF },
      { fetch },
    );

    expect(price).toBeNull();
  });

  it("같은 세대의 중복 행이 최종 갱신일까지 같은데 금액이 다르면 null", async () => {
    const fetch = yearFetch({
      "2026": body([row({ pblntfPc: "2700000000" }), row({ pblntfPc: "2702000000" })]),
    });
    const price = await fetchOfficialPrice(
      { pnu: APT_PNU, dong: "28", ho: "1207", asOf: AS_OF },
      { fetch },
    );

    expect(price).toBeNull();
  });
});

describe("fetchOfficialPrice 오류", () => {
  it("인증키 오류는 api 오류이고 키는 가려진다", async () => {
    const fetch = yearFetch({ "2026": "vworld/error-invalid-key.json" });
    const error = await fetchOfficialPrice(
      { pnu: APT_PNU, dong: "28", ho: "1207", asOf: AS_OF },
      { fetch },
    ).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(PublicDataError);
    expect(error).toMatchObject({ kind: "api", source: "vworld" });
    expect((error as PublicDataError).message).toContain("INVALID_KEY");
    expect((error as PublicDataError).message).not.toContain(KEY);
  });

  it("일일 한도 초과는 quota 오류", async () => {
    const fetch = yearFetch({ "2026": "vworld/error-quota.json" });
    await expect(
      fetchOfficialPrice({ pnu: APT_PNU, dong: "28", ho: "1207", asOf: AS_OF }, { fetch }),
    ).rejects.toMatchObject({ kind: "quota", source: "vworld" });
  });

  it("JSON이 아니면 parse 오류", async () => {
    const fetch = yearFetch({ "2026": { body: "<html>점검 중</html>" } });
    await expect(
      fetchOfficialPrice({ pnu: APT_PNU, dong: "28", ho: "1207", asOf: AS_OF }, { fetch }),
    ).rejects.toMatchObject({ kind: "parse", source: "vworld" });
  });

  it("알 수 없는 루트 요소면 parse 오류", async () => {
    const fetch = yearFetch({ "2026": { body: JSON.stringify({ something: {} }) } });
    await expect(
      fetchOfficialPrice({ pnu: APT_PNU, dong: "28", ho: "1207", asOf: AS_OF }, { fetch }),
    ).rejects.toMatchObject({ kind: "parse", source: "vworld" });
  });

  it("공시가격이 숫자가 아니면 parse 오류", async () => {
    const fetch = yearFetch({ "2026": body([row({ pblntfPc: "2,702,000,000원" })]) });
    await expect(
      fetchOfficialPrice({ pnu: APT_PNU, dong: "28", ho: "1207", asOf: AS_OF }, { fetch }),
    ).rejects.toMatchObject({ kind: "parse", source: "vworld" });
  });

  it("5xx는 재시도 후 http 오류", async () => {
    const fetch = yearFetch({ "2026": { body: "error", status: 503 } });
    await expect(
      fetchOfficialPrice(
        { pnu: APT_PNU, dong: "28", ho: "1207", asOf: AS_OF },
        { fetch, ...noDelay },
      ),
    ).rejects.toMatchObject({ kind: "http", status: 503 });
    expect(fetch.calls).toHaveLength(3);
  });
});
