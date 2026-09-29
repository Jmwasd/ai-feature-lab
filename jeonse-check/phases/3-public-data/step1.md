# Step 1: address-normalize

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md` (외부 API 테스트 금지 CRITICAL)
- `/docs/ARCHITECTURE.md` (server 어댑터: 원본 응답 형식은 어댑터 밖으로 나가지 않는다)
- `/docs/PRD.md` (데이터 제약: 지번·도로명 정규화, `LAWD_CD`)
- `/.env.example` (`JUSO_API_KEY`)
- `/src/server/env.ts`, `/src/server/public-data/http.ts`, `xml.ts`, `__fixtures__/load.ts` (step 0)
- `/src/features/lookup-input/schema.ts` (phase 2: `AddressCandidate` 구조. import하지 않는다)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

행정안전부 도로명주소 검색 API(business.juso.go.kr `addrLinkApi.do`, `resultType=json`) 어댑터를 만든다. 사용자 주소 검색과, 다른 API가 요구하는 코드(법정동코드, 번·지, PNU) 추출을 맡는다.

### 1. 어댑터 (`src/server/public-data/juso.ts`)

```ts
import "server-only";
export interface NormalizedAddress {
  id: string;               // 건물관리번호(bdMgtSn)
  roadAddress: string;
  jibunAddress: string;
  buildingName: string | null;
  admCd: string;            // 법정동코드 10자리
  lawdCd: string;           // admCd 앞 5자리 (실거래가 LAWD_CD)
  sidoName: string;
  sigunguName: string;
  umdName: string;          // 법정 읍면동명 (리가 있으면 규칙을 JSDoc에 적는다)
  isMountain: boolean;      // 산 여부
  mainNo: number;           // 본번
  subNo: number;            // 부번 (없으면 0)
  jibun: string;            // "123-4" 또는 "123"
  pnu: string;              // 19자리: admCd(10) + 산구분(1: 일반 "1", 산 "2") + 본번 4자리 + 부번 4자리
}
export async function searchAddress(keyword: string, options?: HttpOptions & { page?: number; perPage?: number }): Promise<NormalizedAddress[]>;
```

- 요청 파라미터 이름·응답 필드명(`admCd`, `lnbrMnnm`, `lnbrSlno`, `mtYn`, `bdMgtSn`, `emdNm`, `liNm` 등)은 juso 개발자센터 공식 명세로 확인한다. `JUSO_API_KEY`가 환경에 있으면 실제 응답을 **한 번만** 받아 fixture로 저장해도 된다(키 값은 fixture에 남기지 않는다). 없으면 공식 명세의 예시로 fixture를 만든다.
- API 오류 코드(`common.errorCode` ≠ "0")는 `PublicDataError(kind: "api")`로 바꾼다. 검색어 부족·결과 없음은 오류가 아니라 빈 배열이다.
- 검색어는 앞뒤 공백을 자르고, 너무 짧거나 특수문자만 있으면 호출하지 않고 빈 배열을 돌려준다(juso 명세의 검색어 제약 확인).
- PNU·jibun 생성은 순수 함수 `buildPnu`, `formatJibun`으로 분리해 테스트한다.

### 2. fixture와 테스트

- `__fixtures__/juso/`: 일반 지번, 산 지번, 부번 없음, 리 단위 주소, 결과 없음, 오류 코드 응답.
- `juso.test.ts`: 필드 매핑, PNU 19자리 규칙, `lawdCd` 추출, 오류 변환, 빈 검색어 미호출.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
grep -rn "confmKey=" src/server/public-data/__fixtures__ && exit 1 || true   # fixture에 키가 없어야 한다
```

## 금지사항

- 테스트에서 실제 juso API를 호출하지 마라. 이유: CLAUDE.md CRITICAL.
- 원본 응답 필드명(`lnbrMnnm` 등)을 어댑터 밖으로 내보내지 마라. 이유: ARCHITECTURE server 규칙.
- `src/features/*`를 import하지 마라. 이유: server는 feature를 참조하지 않는다. `AddressCandidate`와의 변환은 phase 5 routes에서 한다.
- 최우선변제 구간·수도권 판별을 여기서 하지 마라. 이유: step 2 범위다.
- 기존 테스트를 깨뜨리지 마라.
