# Step 2: resume-parser

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `docs/PLAN.md` — 4절 "근거의 단위는 Notion 블록이다", 10절 "테스트 규율"
- `docs/ARCHITECTURE.md` — "근거의 단위는 Notion 블록이다" 절
- `docs/ADR.md` — ADR-003 · ADR-004 · ADR-009
- `src/types/index.ts` — 이전 step에서 만든 `ResumeEvidence`
- `vitest.config.ts` — 테스트가 어디를 include 하는지 확인하라

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 이 step이 프로젝트에서 가장 중요한 이유

`docs/PLAN.md` 8절: *"M0을 먼저 두는 이유는 이력서 파싱이 나머지 전부의 입력이기 때문이다. 근거 목록이 엉망이면 그 위의 매칭 품질은 볼 필요가 없다."*

## 작업

**테스트를 먼저 쓰고 구현한다 (TDD).** `CLAUDE.md`가 `src/lib/`에 대해 이것을 CRITICAL로 요구한다. 테스트 파일을 먼저 만들어 실패를 확인한 뒤 구현하라.

- `src/lib/resume-parser.test.ts` (먼저)
- `src/lib/resume-parser.ts` (나중)

### 입력 타입

`src/lib/`은 순수 함수만 두는 잎이라 `@notionhq/client`를 import 할 수 없다. 파서가 소비할 **최소 구조를 이 파일에서 직접 정의**한다. Notion API 응답을 이 형태로 정규화하는 일은 다음 step의 `src/services/notion.ts`가 한다.

```ts
export interface NotionBlockNode {
  id: string;                  // Notion 블록 ID
  type: string;                // 'heading_2' | 'heading_3' | 'bulleted_list_item' | 'code' | ...
  text: string;                // rich_text를 이어붙인 평문. 텍스트가 없는 타입이면 빈 문자열
  children: NotionBlockNode[]; // 자식이 없으면 빈 배열
}
```

### 시그니처

```ts
export const MIN_EVIDENCE_LENGTH = 15;

export function parseResume(blocks: NotionBlockNode[]): ResumeEvidence[];
```

내부 구현은 재량이지만 아래 규칙에서 벗어나면 안 된다.

### 파싱 규칙

**1. 소속 물고 내려가기**

- `heading_2` → 현재 **회사**. 새 `heading_2`를 만나면 현재 프로젝트를 빈 문자열로 초기화한다
- `heading_3` → 현재 **프로젝트**
- 문서 시작부터 첫 `heading_2` 전까지 나온 근거는 `company`와 `project`가 빈 문자열이다. **버리지 마라** — 이력서 상단의 기술 스택 요약이 여기 있을 수 있다

**2. 회사명에서 기간 괄호를 잘라낸다**

이력서의 H2는 `소프트보울 ( 2024. 02 - 재직중 )` 형태다. 괄호와 그 안의 내용을 잘라내고 앞뒤 공백을 제거해 `소프트보울`만 남긴다.

**괄호 안의 날짜를 파싱하지 마라.** ADR-009: 이력서에서 확정 가능한 것은 회사 재직 기간뿐인데 그것은 공고가 묻는 기술 경력 기간이 아니다. 잘라내기만 하고 값을 읽지 않는다.

H3의 `Bidbowl (맞춤형 공공 입찰 정보 구독 플랫폼)` 같은 괄호는 **설명이므로 남긴다.** 회사(H2)에만 괄호 제거를 적용한다.

**3. 근거 후보 블록**

`bulleted_list_item` · `numbered_list_item` · `paragraph` · `toggle` 을 근거 후보로 본다.

**4. 코드블록을 불릿에 흡수한다 (이 파서의 핵심)**

근거 후보 블록의 **직계 자식 중 `type === 'code'`인 블록**의 텍스트를 부모 텍스트 뒤에 개행으로 이어붙인다.

- 앵커 `blockId`는 **부모(불릿)의 ID**다. 코드블록 ID가 아니다
- 코드블록이 여러 개면 문서 순서대로 전부 이어붙인다
- 흡수한 코드블록은 **독립 근거로 다시 만들지 않는다**

이유: 불릿만 읽으면 `인프라 & 배포 프로세스 구축` 같은 제목뿐이고 매칭에 필요한 기술명은 전부 코드블록 안에 있다. 코드블록은 내부 줄에 개별 ID가 없어서(블록 하나에 ID 하나) 앵커로 쓸 수 없다.

**5. 코드블록이 아닌 자식은 독립 근거로 재귀 처리한다**

중첩 불릿은 자기 ID로 자기 근거가 된다. 부모의 소속(회사·프로젝트)을 그대로 물려받는다.

**6. 노이즈 제외**

- **`column_list`와 `column`은 서브트리 전체를 건너뛴다.** 2단 컬럼 안에 연락처와 사진이 있다
- `image` · `divider` · `table_of_contents` · `child_page` · `child_database` · `embed` · `video` · `file` · `bookmark` 는 근거로 만들지 않는다
- 텍스트가 비었거나 공백뿐이면 버린다
- **코드블록을 흡수한 뒤의 최종 텍스트** 길이가 `MIN_EVIDENCE_LENGTH` 미만이면 버린다

길이 판정을 흡수 **뒤에** 하는 이유: 짧은 불릿에 알맹이가 든 코드블록이 딸려 있는 것이 이 이력서의 주된 형태다. 흡수 전에 자르면 그 덩어리가 통째로 날아간다.

**7. 중복 제거와 순서**

- 같은 `blockId`가 두 번 나오면 처음 것만 남긴다
- 결과는 문서 등장 순서를 보존한다

### 테스트 케이스 (최소한 이만큼)

1. H2 `소프트보울 ( 2024. 02 - 재직중 )` → `company === '소프트보울'`
2. H3 프로젝트명이 `project`에 붙는다. H3의 괄호는 남는다
3. 불릿 + 자식 코드블록 1개 → 텍스트가 개행으로 이어붙고 `blockId`는 불릿의 것
4. 자식 코드블록 2개 → 문서 순서대로 이어붙는다
5. 흡수된 코드블록이 독립 근거로 중복 등장하지 않는다
6. 불릿 자체는 `MIN_EVIDENCE_LENGTH` 미만이지만 코드블록 흡수 후 넘으면 **살아남는다**
7. 흡수 후에도 `MIN_EVIDENCE_LENGTH` 미만이면 버린다
8. `column_list` 서브트리 전체가 제외된다 (그 안의 불릿도 안 나온다)
9. `image` · `divider`가 제외된다
10. 텍스트가 공백뿐인 블록이 제외된다
11. 새 H2를 만나면 프로젝트가 초기화된다 (이전 H3가 새 회사로 새지 않는다)
12. 중첩 불릿이 부모의 회사·프로젝트를 물려받아 독립 근거가 된다
13. 첫 H2 이전 블록은 `company === ''`, `project === ''`이고 버려지지 않는다
14. 같은 `blockId`가 두 번 들어오면 하나만 남는다
15. 빈 배열을 넣으면 빈 배열이 나온다

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm run lint    # 통과
npm test        # 위 테스트 전부 통과
```

추가로 확인한다:

```bash
grep -nE "^import|require\(" src/lib/resume-parser.ts
# @/types 외의 import가 있으면 안 된다. react·next·@notionhq/client·fs·프롬프트 전부 금지
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `src/lib/`이 잎으로 남았는가? React·Next·네트워크·프롬프트·Notion SDK를 import 하지 않았는가?
   - `docs/ARCHITECTURE.md`의 레이어 방향(`app → services → 외부`, `lib`은 잎)을 따르는가?
   - `CLAUDE.md` CRITICAL 규칙을 위반하지 않았는가? 특히:
     - 근거 텍스트를 지어내지 않고 입력 블록의 원문만 쓰는가
     - 저장 계층(IndexedDB·DB·파일 캐시)을 만들지 않았는가
   - 테스트를 **먼저** 썼는가? (구현부터 쓰고 테스트를 나중에 맞추면 TDD가 아니다)
3. 결과에 따라 `phases/0-notion-resume/index.json`의 step 2를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

`summary`에는 `NotionBlockNode`의 필드와 `parseResume` 시그니처를 적어라. 다음 step의 서비스가 이 형태로 정규화해서 넘겨야 한다.

## 금지사항

- **`@notionhq/client`를 import 하지 마라.** 이유: `src/lib/`은 순수 함수만 두는 잎이다. SDK 타입에 묶이면 테스트에 SDK가 따라 들어오고 순수성이 깨진다
- **H2 괄호 안의 기간을 파싱하지 마라.** 이유: ADR-009 — 회사 재직 기간은 공고가 묻는 기술 경력 기간이 아니다. 계산해 봐야 요구사항에 대한 답이 아니다
- **코드블록을 독립 근거로 만들지 마라.** 이유: ADR-004 — 코드블록 ID를 앵커로 쓰면 `인프라 & 배포 프로세스 구축` 같은 불릿 제목이 근거에서 떨어져 나가 무슨 맥락의 기술인지 알 수 없게 된다
- **길이 필터를 코드블록 흡수 전에 적용하지 마라.** 이유: 짧은 불릿 + 알맹이 코드블록이 이 이력서의 주된 형태다. 흡수 전에 자르면 그 덩어리가 통째로 사라진다
- **텍스트를 요약·정리·번역하지 마라.** 이유: 화면에 나가는 근거는 Notion 원문이어야 한다. 파서가 문장을 손대면 사용자가 원문과 대조할 수 없다
- **네트워크 호출·`fs` 접근·`process.env` 읽기를 넣지 마라.** 이유: 순수 함수여야 테스트가 실제 API 없이 돌아간다
- **날짜 계산 · 경력 개월 수 계산 코드를 넣지 마라.** 이유: ADR-009
- 기존 테스트를 깨뜨리지 마라
