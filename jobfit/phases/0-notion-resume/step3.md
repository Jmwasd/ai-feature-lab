# Step 3: notion-service

## 읽어야 할 파일

- `src/types/index.ts` — `ResumeEvidence`
- `src/lib/resume-parser.ts` — **`NotionBlockNode` 형태와 `parseResume` 시그니처. 이 서비스가 그 형태로 정규화해서 넘긴다**
- `src/lib/resume-parser.test.ts` — 파서가 어떤 입력을 기대하는지 테스트로 확인하라

레이어 방향은 `docs/ARCHITECTURE.md`, 이력서 소스 결정은 ADR-002 · ADR-005에 있다.

## 작업

`src/services/notion.ts`와 `src/services/notion.test.ts`를 만든다. `@notionhq/client`를 dependency로 설치한다.

### 서버 전용 보증

파일 **첫 줄**에 `import 'server-only';`를 넣는다. `server-only` 패키지를 설치하라.

이유: `CLAUDE.md`가 "비밀값은 Route Handler 안에서만 읽는다"를 CRITICAL로 요구한다. `server-only`는 이 모듈이 클라이언트 번들에 섞이는 순간 **빌드를 실패시킨다.** 규율이 아니라 구조로 막는 편이 확실하다.

### 시그니처

```ts
// 재귀 순회를 테스트할 수 있도록 리스터를 주입받는다
export interface BlockLister {
  list(args: { blockId: string; startCursor?: string }): Promise<BlockListPage>;
}

export interface BlockListPage {
  results: unknown[];        // Notion API의 블록 객체들
  hasMore: boolean;
  nextCursor: string | null;
}

/** 블록 트리를 재귀 순회해 파서가 먹는 형태로 정규화한다 */
export async function fetchBlockTree(lister: BlockLister, rootId: string): Promise<NotionBlockNode[]>;

/** 환경 변수를 읽어 실제 Notion을 호출하고 근거 목록까지 만든다 */
export async function getResumeEvidence(): Promise<ResumeEvidence[]>;
```

`getResumeEvidence`는 `fetchBlockTree` + `parseResume`를 이어 붙인 얇은 함수여야 한다. 파싱 로직을 여기에 다시 쓰지 마라.

### 순회 규칙

- `blocks.children.list`를 쓴다. `page_size`는 100
- **페이지네이션**: `has_more`가 참이면 `next_cursor`로 이어 읽어 한 부모의 자식을 전부 모은다
- **재귀**: `has_children`이 참인 블록마다 자식을 조회한다
- **깊이 상한 6.** 넘으면 더 내려가지 않는다. 이유: 순환이나 비정상 구조에서 무한 재귀로 API 호출이 폭주하는 것을 막는다

### 정규화 규칙

Notion 블록 객체를 `NotionBlockNode`로 바꾼다.

- `id` → `id`
- `type` → `type`
- `text`: 해당 타입 payload의 `rich_text` 배열에서 `plain_text`를 순서대로 이어붙인다. `code` 타입도 `rich_text`에 내용이 들어 있다. `rich_text`가 없는 타입(`image` · `divider` 등)은 빈 문자열
- `children`: 재귀 결과. 없으면 빈 배열

정규화는 **어떤 블록도 버리지 않는다.** 무엇을 근거로 삼고 무엇을 노이즈로 버릴지는 전부 `parseResume`가 정한다. 서비스가 미리 걸러내면 판정 기준이 두 곳으로 갈라진다.

### 환경 변수

`getResumeEvidence` 안에서 `process.env.NOTION_TOKEN`과 `process.env.NOTION_RESUME_PAGE_ID`를 읽는다. 둘 중 하나라도 없으면 **무엇이 없는지 이름을 밝힌 에러를 던진다.** 조용히 빈 배열을 반환하지 마라 — 설정 누락과 "근거가 하나도 없는 이력서"는 다르다.

### 테스트 (실제 API 없이 mock으로)

`BlockLister`를 구현한 fake 객체로 검증한다.

1. 자식이 있는 블록을 재귀로 따라 내려간다
2. `hasMore: true` → `nextCursor`로 이어 읽어 두 페이지의 결과가 모두 합쳐진다
3. `rich_text` 여러 조각이 순서대로 이어붙고, `code` 블록의 내용도 `text`로 나온다
4. 깊이 상한을 넘으면 더 내려가지 않는다
5. `has_children`이 거짓인 블록에는 자식 조회를 **시도하지 않는다** (호출 횟수로 확인)
6. `getResumeEvidence`가 `NOTION_TOKEN` 없이 호출되면 그 이름이 담긴 에러를 던진다

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm run lint    # 통과
npm test        # 위 테스트 전부 통과

head -1 src/services/notion.ts                    # import 'server-only';
grep -rn "notion" src/lib/ src/components/         # 결과 없음
grep -rn "NEXT_PUBLIC" src/                        # 결과 없음
```

추가로 확인한다: 결과를 캐시하지 않았는가? (ADR-005 — 이력서는 요청 때마다 읽는다)

**이 step은 `blocked`가 되면 안 된다.** 테스트가 전부 mock이라 실제 Notion 토큰 없이 완료된다. 키가 없다는 이유로 중단하지 마라.

`summary`에는 export한 함수 시그니처와 `server-only`를 썼다는 사실을 적어라.

## 금지사항

- **실제 Notion API를 부르는 테스트를 만들지 마라.** 이유: `docs/PLAN.md` 10절 — 서비스 경계는 실제 API 없이 mock으로 검증한다. 매 실행마다 네트워크와 토큰에 의존하면 테스트가 아니라 통합 점검이 된다
- **페이지를 마크다운으로 받는 API를 쓰지 마라.** 이유: 블록 ID를 주지 않아 앵커링에 쓸 수 없다. 앵커가 없으면 ADR-003의 지어내기 방지가 통째로 무너진다
- **결과를 파일·메모리·DB에 캐시하지 마라.** 이유: ADR-005 — 이력서는 요청 때마다 읽는다. 캐시를 두는 순간 stale 판정과 무효화 코드가 따라온다
- **서비스에서 블록을 걸러내지 마라 (노이즈 판정·길이 필터 등).** 이유: 그 기준은 `parseResume` 한 곳에만 있어야 한다. 두 곳으로 갈라지면 테스트가 잡지 못하는 어긋남이 생긴다
- **`NEXT_PUBLIC_NOTION_*` 같은 변수를 만들지 마라.** 이유: 브라우저 번들에 토큰이 박힌다
- **설정이 없을 때 빈 배열을 반환하지 마라.** 이유: "설정 누락"과 "근거 없음"을 같게 취급하면 화면이 조용히 거짓말을 한다
