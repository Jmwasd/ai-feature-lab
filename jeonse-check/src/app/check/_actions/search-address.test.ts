import { beforeEach, describe, expect, it, vi } from "vitest";
import { PublicDataError } from "@/server/public-data/http";
import type { NormalizedAddress } from "@/server/public-data/juso";

const { auth, searchAddress } = vi.hoisted(() => ({ auth: vi.fn(), searchAddress: vi.fn() }));
vi.mock("@/server/auth", () => ({ auth }));
vi.mock("@/server/public-data/juso", () => ({ searchAddress }));

import { searchAddressAction } from "./search-address";

const SESSION = { user: { id: "u1" }, expires: "2099-01-01T00:00:00.000Z" };

const ADDRESS: NormalizedAddress = {
  id: "1144012400100120004000001",
  roadAddress: "서울특별시 마포구 망원로 12",
  jibunAddress: "서울특별시 마포구 망원동 123-4 망원빌라",
  buildingName: "망원빌라",
  admCd: "1144012400",
  lawdCd: "11440",
  sidoName: "서울특별시",
  sigunguName: "마포구",
  umdName: "망원동",
  isMountain: false,
  mainNo: 123,
  subNo: 4,
  jibun: "123-4",
  pnu: "1144012400101230004",
};

beforeEach(() => {
  auth.mockReset().mockResolvedValue(SESSION);
  searchAddress.mockReset().mockResolvedValue([ADDRESS]);
});

describe("searchAddressAction", () => {
  it("세션이 없으면 unauthorized이고 주소 API를 부르지 않는다", async () => {
    auth.mockResolvedValue(null);

    expect(await searchAddressAction("망원로 12")).toEqual({ ok: false, error: "unauthorized" });
    expect(searchAddress).not.toHaveBeenCalled();
  });

  it.each([
    ["문자열이 아님", 123 as unknown as string],
    ["빈 검색어", "   "],
    ["너무 긴 검색어", "가".repeat(101)],
  ])("%s이면 invalid이고 주소 API를 부르지 않는다", async (_, keyword) => {
    expect(await searchAddressAction(keyword)).toEqual({ ok: false, error: "invalid" });
    expect(searchAddress).not.toHaveBeenCalled();
  });

  it("NormalizedAddress를 AddressCandidate로 바꿔 돌려준다", async () => {
    const result = await searchAddressAction("  망원로 12 ");

    expect(searchAddress).toHaveBeenCalledWith("망원로 12");
    expect(result).toEqual({
      ok: true,
      candidates: [
        {
          id: ADDRESS.id,
          roadAddress: ADDRESS.roadAddress,
          jibunAddress: ADDRESS.jibunAddress,
          buildingName: ADDRESS.buildingName,
          admCd: ADDRESS.admCd,
        },
      ],
    });
  });

  it("주소 API 오류는 unavailable로만 알리고 원본 메시지를 싣지 않는다", async () => {
    searchAddress.mockRejectedValue(
      new PublicDataError("http", "juso", "HTTP 500", { url: new URL("https://example.test/?confmKey=secret") }),
    );

    const result = await searchAddressAction("망원로 12");
    expect(result).toEqual({ ok: false, error: "unavailable" });
    expect(JSON.stringify(result)).not.toContain("juso");
  });

  it("예상 못 한 예외도 unavailable로 바꾼다", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    searchAddress.mockRejectedValue(new Error("JUSO_API_KEY 환경변수가 없다"));

    expect(await searchAddressAction("망원로 12")).toEqual({ ok: false, error: "unavailable" });
    consoleError.mockRestore();
  });
});
