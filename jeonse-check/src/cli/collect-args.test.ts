import { describe, expect, it } from "vitest";

import { CollectArgsError, parseCollectArgs } from "./collect-args";

const base = ["--lawd", "11680", "--from", "202401", "--to", "202403"];

describe("parseCollectArgs", () => {
  it("기본값: 두 주택 유형, 매매, force·dry-run 꺼짐", () => {
    expect(parseCollectArgs(base)).toEqual({
      lawdCds: ["11680"],
      from: "202401",
      to: "202403",
      houseTypes: ["APARTMENT", "ROW_HOUSE"],
      dealKinds: ["SALE"],
      force: false,
      dryRun: false,
    });
  });

  it("쉼표로 여러 지역을 받고 중복은 한 번만 남긴다", () => {
    const args = parseCollectArgs(["--lawd", "11680,11440, 11680", "--from", "202401", "--to", "202401"]);
    expect(args.lawdCds).toEqual(["11680", "11440"]);
  });

  it("--type, --kind, --force, --dry-run을 읽는다", () => {
    const args = parseCollectArgs([
      ...base,
      "--type",
      "row-house",
      "--kind",
      "sale,lease",
      "--force",
      "--dry-run",
    ]);
    expect(args.houseTypes).toEqual(["ROW_HOUSE"]);
    expect(args.dealKinds).toEqual(["SALE", "LEASE"]);
    expect(args.force).toBe(true);
    expect(args.dryRun).toBe(true);
  });

  it("from과 to가 같은 달이면 허용한다", () => {
    expect(parseCollectArgs(["--lawd", "11680", "--from", "202401", "--to", "202401"]).to).toBe("202401");
  });

  it.each([["1168"], ["116800"], ["1168a"], [""], ["11680,"]])("잘못된 지역 코드 %j를 거부한다", (lawd) => {
    expect(() => parseCollectArgs(["--lawd", lawd, "--from", "202401", "--to", "202403"])).toThrow(
      CollectArgsError,
    );
  });

  it.each([["2024-01"], ["202413"], ["202400"], ["24001"]])("잘못된 월 형식 %j를 거부한다", (ymd) => {
    expect(() => parseCollectArgs(["--lawd", "11680", "--from", ymd, "--to", "202403"])).toThrow(
      CollectArgsError,
    );
    expect(() => parseCollectArgs(["--lawd", "11680", "--from", "202401", "--to", ymd])).toThrow(
      CollectArgsError,
    );
  });

  it("from이 to보다 뒤면 거부한다", () => {
    expect(() => parseCollectArgs(["--lawd", "11680", "--from", "202405", "--to", "202403"])).toThrow(
      CollectArgsError,
    );
  });

  it("필수 인자가 빠지면 거부한다", () => {
    expect(() => parseCollectArgs(["--from", "202401", "--to", "202403"])).toThrow(CollectArgsError);
    expect(() => parseCollectArgs(["--lawd", "11680", "--to", "202403"])).toThrow(CollectArgsError);
    expect(() => parseCollectArgs(["--lawd", "11680", "--from", "202401"])).toThrow(CollectArgsError);
  });

  it("알 수 없는 옵션, 유형, 거래 종류를 거부한다", () => {
    expect(() => parseCollectArgs([...base, "--verbose"])).toThrow(CollectArgsError);
    expect(() => parseCollectArgs([...base, "--type", "officetel"])).toThrow(CollectArgsError);
    expect(() => parseCollectArgs([...base, "--kind", "rent"])).toThrow(CollectArgsError);
    expect(() => parseCollectArgs([...base, "extra"])).toThrow(CollectArgsError);
  });
});
