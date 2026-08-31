# 아키텍처

## 디렉토리 구조

```
src/
├── app/
│   ├── page.tsx              # 랜딩 겸 결과 (페이지 하나)
│   └── api/analyze/route.ts  # 유일한 Route Handler
├── components/               # UI 컴포넌트
├── types/                    # Requirement · Verdict · ResumeEvidence
├── lib/                      # 순수 함수 (React·Next·네트워크·프롬프트 import 금지)
├── prompts/                  # 프롬프트 파일 (코드 인라인 금지)
└── services/                 # Notion · OpenAI · 공고 URL fetch
```

레이어 규칙은 한 방향이다.

```
app ──▶ services ──▶ 외부(Notion / OpenAI / 공고 사이트)
 │          │
 └──────────┴──▶ lib (순수 함수)   ◀── 아무것도 import 하지 않는다
```

- `lib/`는 잎(leaf)이다. 여기서 무언가를 import 하고 싶어지면 그 로직은 `lib/`에 있으면 안 되는 것이다.
- `services/`만 네트워크를 만진다. `app/`이 `fetch`를 직접 부르지 않는다.
- `types/`는 모두가 import 한다.

## 데이터 모델

```
ResumeEvidence  { blockId, text, company, project }
JobPosting      { sourceUrl?, rawText }
Requirement     { id, text, kind: 'must' | 'nice', requiredMonths? }
Verdict         { requirementId, bucket: covered | implicit | missing,
                  evidenceBlockIds: string[], confidence, suggestion?,
                  suggestionEvidenceBlockIds?: string[] }
```

전부 요청 하나 안에서 살고 죽는다. 영속화하는 것이 없다.

### 근거의 단위는 Notion 블록이다

안정 ID를 직접 만들지 않는다. Notion 블록 ID가 이미 영구적이고 문구를 고쳐도 유지된다.

이력서의 실제 구조:

```
H2  소프트보울 ( 2024. 02 - 재직중 )              ← 회사 + 기간
  H3  Bidbowl (맞춤형 공공 입찰 정보 구독 플랫폼)   ← 프로젝트
      문단  프로젝트 설명 / 기술 스택 / [ 주요 성과 ]
      불릿  "인프라 & 배포 프로세스 구축"
        코드블록  Docker 멀티 스테이지 빌드 …      ← 알맹이가 여기 있다
```

- **불릿과 그 아래 코드블록을 한 덩어리로 묶는다.** 불릿만 읽으면 제목뿐이고 매칭에 필요한 기술명은 코드블록 안에 있다. 코드블록은 내부 줄에 개별 ID가 없으므로 앵커는 **불릿 블록 ID**로 하고 텍스트는 둘을 이어붙인다.
- H2를 회사와 기간으로, H3를 프로젝트로 물고 내려가며 각 근거에 소속을 붙인다.
- H2 제목의 `( 2024. 02 - 재직중 )` 구간은 회사명을 뽑을 때 잘라내기만 하고 **파싱하지 않는다.**
- 노이즈는 코드가 뺀다 — 2단 컬럼 안의 연락처·사진, 빈 블록, 이미지, 텍스트가 극히 짧은 블록.
- 읽기는 `blocks.children.list` 재귀 순회로 한다. 페이지를 마크다운으로 받는 API는 블록 ID를 주지 않아 앵커링에 쓸 수 없다.

## 데이터 흐름

`POST /api/analyze` 하나가 전부를 한다. 입력은 `{ url }` 또는 `{ text }` 중 **정확히 하나**이며, 길이·형식 제한을 먼저 검증한다.

```
{ url } 또는 { text }
 1. 공고 본문 확보   URL fetch → Readability → 실패면 폴백 신호를 반환하고 끝
 2. 이력서 읽기      Notion 재귀 순회 → ResumeEvidence[]
 3. LLM ①           공고 → Requirement[]  (원자적 문구 / must·nice / 요구 개월 수)
 4. LLM ②           Requirement[] × ResumeEvidence[] → Verdict[]
                    블록 ID만 반환. bucket이 implicit이면 suggestion과
                    suggestionEvidenceBlockIds도 같은 객체에 채운다
 5. 코드            실재하지 않는 blockId 폐기 · 제안 근거 blockId 존재 검증 · 3분할 집계
 6. 응답            원문 근거와 함께 반환
```

- 매칭은 **요구사항 전체 × 이력서 전체를 한 번에** 보낸다. 이력서는 한 사람 분량이고 요구사항은 20개 안쪽이라 컨텍스트가 감당한다. 품질 열화가 관찰되면 그때 배치로 내려간다.
- 공고 원문과 근거 목록은 모델 컨텍스트 한도를 넘기지 않도록 각자 상한을 둔다.
- 응답이 일부만 오거나 JSON Schema 검증에 실패하면 **누락분만 담아 자동으로 한 번 더** 부른다. 그래도 없으면 "판정 없음"으로 남긴다.

## 공고 URL fetch 가드레일

기본만 둔다. HTTP/HTTPS만 허용하고 localhost와 사설 IP를 거부하며, 응답 크기 상한·짧은 타임아웃·리다이렉트 횟수 상한을 둔다. 로컬 개인 도구를 위해 별도 네트워크 프록시나 DNS 재검증 계층은 만들지 않는다.

본문이 임계값보다 짧으면 **실패로 간주**하고 조용히 넘기지 않는다. "이 사이트는 본문을 읽지 못했습니다. 공고 내용을 복사해 붙여넣어 주세요" 안내와 함께 폴백 textarea를 연다.

## 패턴

- Server Components 기본. 인터랙션이 필요한 곳(입력 폼, 결과 토글, 복사 버튼)만 Client Component.
- 결과는 `/api/analyze` 응답을 그대로 화면 상태로 들고 있는다. 캐시하지 않는다.

## 상태 관리

라이브러리를 쓰지 않는다. 페이지 하나에 `useState`로 충분하다.

```
idle → loading → result
              ↘ needsPaste (본문 추출 실패)
              ↘ error
```

새로고침하면 `idle`로 돌아간다. 이것은 결함이 아니라 저장하지 않기로 한 결정의 결과다.
