import "server-only";

// 서버가 읽는 외부 API 키. 목록과 발급처는 .env.example에 있다.
export type ServerEnvName =
  | "DATA_GO_KR_SERVICE_KEY"
  | "VWORLD_API_KEY"
  | "VWORLD_API_DOMAIN"
  | "JUSO_API_KEY";

// 오류에는 변수 이름만 담는다. 값은 어떤 경우에도 넣지 않는다.
export class MissingEnvError extends Error {
  readonly variable: ServerEnvName;

  constructor(variable: ServerEnvName) {
    super(`환경변수 ${variable}가 설정되지 않았다. .env.example을 참고해 .env에 채운다.`);
    this.name = "MissingEnvError";
    this.variable = variable;
  }
}

// 호출 시점에 읽는다. 키가 없는 빌드·테스트 환경에서 import만으로 실패하지 않게 한다.
// .env.example의 기본값("")도 없는 것으로 본다.
export function requireEnv(name: ServerEnvName): string {
  const value = process.env[name];
  if (!value) {
    throw new MissingEnvError(name);
  }
  return value;
}
