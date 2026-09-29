import { parseArgs } from "node:util";

import type { TradeDealKind, TradeHouseType } from "@/server/public-data/molit-trade";
import { monthRange } from "@/server/trades/months";

// npm run collect 인자 파싱. 실행과 분리해 DB·API 없이 테스트한다.

export const COLLECT_USAGE = `사용법:
  npm run collect -- --lawd <코드[,코드...]> --from <YYYYMM> --to <YYYYMM> [옵션]

  --lawd      법정동코드 앞 5자리. 쉼표로 여러 개 (예: 11680,11440)
  --from      시작 계약월 YYYYMM (포함)
  --to        끝 계약월 YYYYMM (포함)
  --type      apartment,row-house 중 선택 (기본: 둘 다)
  --kind      sale,lease 중 선택 (기본: sale)
  --force     신선도와 상관없이 다시 받는다
  --dry-run   받을 단위 목록만 출력한다 (DB·API에 연결하지 않는다)`;

export interface CollectArgs {
  lawdCds: string[];
  from: string;
  to: string;
  houseTypes: TradeHouseType[];
  dealKinds: TradeDealKind[];
  force: boolean;
  dryRun: boolean;
}

export class CollectArgsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CollectArgsError";
  }
}

const HOUSE_TYPES: Record<string, TradeHouseType> = {
  apartment: "APARTMENT",
  "row-house": "ROW_HOUSE",
};

const DEAL_KINDS: Record<string, TradeDealKind> = {
  sale: "SALE",
  lease: "LEASE",
};

export function parseCollectArgs(argv: string[]): CollectArgs {
  let values;
  try {
    ({ values } = parseArgs({
      args: argv,
      options: {
        lawd: { type: "string" },
        from: { type: "string" },
        to: { type: "string" },
        type: { type: "string" },
        kind: { type: "string" },
        force: { type: "boolean", default: false },
        "dry-run": { type: "boolean", default: false },
      },
      strict: true,
      allowPositionals: false,
    }));
  } catch (error) {
    throw new CollectArgsError(error instanceof Error ? error.message : String(error));
  }

  const { lawd, from, to } = values;
  if (lawd === undefined) throw new CollectArgsError("--lawd가 필요하다");
  if (from === undefined) throw new CollectArgsError("--from이 필요하다");
  if (to === undefined) throw new CollectArgsError("--to가 필요하다");

  const lawdCds = unique(splitList(lawd));
  if (lawdCds.length === 0) throw new CollectArgsError("--lawd가 비어 있다");
  for (const code of lawdCds) {
    if (!/^\d{5}$/.test(code)) throw new CollectArgsError(`지역 코드는 숫자 5자리여야 한다: ${code}`);
  }

  // 월 형식과 from ≤ to 검사는 수집 범위를 만드는 monthRange와 같은 규칙을 쓴다.
  try {
    monthRange(from, to);
  } catch (error) {
    throw new CollectArgsError(error instanceof Error ? error.message : String(error));
  }

  return {
    lawdCds,
    from,
    to,
    houseTypes: values.type === undefined ? ["APARTMENT", "ROW_HOUSE"] : mapList(values.type, HOUSE_TYPES, "--type"),
    dealKinds: values.kind === undefined ? ["SALE"] : mapList(values.kind, DEAL_KINDS, "--kind"),
    force: values.force,
    dryRun: values["dry-run"],
  };
}

// 빈 항목도 남겨서 "11680,"처럼 끝에 쉼표가 붙은 입력을 오류로 잡는다.
function splitList(raw: string): string[] {
  return raw.split(",").map((item) => item.trim());
}

function mapList<T>(raw: string, table: Record<string, T>, flag: string): T[] {
  const items = unique(splitList(raw));
  return items.map((item) => {
    const mapped = Object.hasOwn(table, item) ? table[item] : undefined;
    if (mapped === undefined) {
      throw new CollectArgsError(`${flag}는 ${Object.keys(table).join(", ")} 중에서 고른다: ${item || "(빈 값)"}`);
    }
    return mapped;
  });
}

function unique(items: string[]): string[] {
  return [...new Set(items)];
}
