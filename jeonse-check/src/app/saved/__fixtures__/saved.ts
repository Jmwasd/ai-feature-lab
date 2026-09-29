import { serializeJudgmentView } from "@/features/judgment/serialize";
import { allSignalsView, FIXTURE_DATA_BASE_DATE, noSignalsView } from "@/features/judgment/ui/__fixtures__/views";
import type { JudgmentView } from "@/features/judgment/ui/types";
import type { SavedResultRepository } from "@/server/saved/repository";

// 저장 목록·상세 테스트용 저장 데이터. 결과는 판정 fixture를 직렬화한 것이다.

export const SESSION = { user: { id: "u1", name: "홍길동" }, expires: "2099-01-01T00:00:00.000Z" };
export const OTHER_USER_ID = "u2";

export function savedInput(view: JudgmentView) {
  const serialized = serializeJudgmentView(view);
  return {
    address: serialized.address,
    houseType: "row-house",
    deposit: serialized.deposit,
    exclusiveArea: serialized.exclusiveArea,
    rights: serialized.rights,
  };
}

export async function saveView(repo: SavedResultRepository, userId: string, view: JudgmentView = noSignalsView) {
  return repo.create(userId, {
    input: savedInput(view),
    result: serializeJudgmentView(view),
    dataBaseDate: FIXTURE_DATA_BASE_DATE,
  });
}

export { allSignalsView, noSignalsView };
