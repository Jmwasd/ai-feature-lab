import { analyze } from "../../../lib/analyze";
import { collectUnclassified } from "../../../lib/categorize";
import { parseTossCsv, type ParseResult } from "../../../lib/parse";
import { classifyMerchants, summarize } from "../../../services/openai";

const XLSX_OLE_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];
const CSV_ONLY_MESSAGE =
  "CSV 파일만 분석할 수 있습니다. 토스뱅크 원본 .xlsx는 암호화된 파일이라 열 수 없습니다. 엑셀, Numbers 또는 Google Sheets에서 비밀번호를 입력한 뒤 CSV로 내보내 업로드해 주세요.";
const INVALID_CSV_MESSAGE = "CSV 파일을 읽을 수 없습니다. CSV로 다시 내보낸 뒤 업로드해 주세요.";
const INTERNAL_ERROR_MESSAGE = "리포트를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.";

export async function POST(req: Request): Promise<Response> {
  let parsed: ParseResult;

  // 업로드 읽기·디코딩·파싱만 이 블록에 둔다. 여기서 나는 실패는 사용자가 고칠 수 있다.
  try {
    const formData = await req.formData();
    const upload = formData.get("file");

    if (!(upload instanceof File)) {
      return badRequest(CSV_ONLY_MESSAGE);
    }

    const bytes = new Uint8Array(await upload.arrayBuffer());

    if (!isCsvUpload(upload, bytes)) {
      return badRequest(CSV_ONLY_MESSAGE);
    }

    parsed = parseTossCsv(decodeCsv(bytes));
  } catch {
    return badRequest(INVALID_CSV_MESSAGE);
  }

  // 분류·집계·요약 단계의 실패는 서버 결함이다. 정상 CSV를 잘못됐다고 말하지 않는다.
  try {
    const llmCategories = await classifyMerchants(collectUnclassified(parsed.transactions));
    const report = analyze(parsed.transactions, {
      queryPeriod: parsed.queryPeriod,
      llmCategories,
    });
    const summary = await summarize(report);

    return Response.json({
      transactions: parsed.transactions,
      queryPeriod: parsed.queryPeriod,
      llmCategories,
      report,
      summary,
    });
  } catch {
    return serverError();
  }
}

function isCsvUpload(upload: File, bytes: Uint8Array): boolean {
  return upload.name.toLowerCase().endsWith(".csv") && !hasXlsxMagic(bytes);
}

function hasXlsxMagic(bytes: Uint8Array): boolean {
  return startsWith(bytes, XLSX_OLE_MAGIC) || startsWith(bytes, ZIP_MAGIC);
}

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((byte, index) => bytes[index] === byte);
}

function decodeCsv(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

function badRequest(error: string): Response {
  return Response.json({ error }, { status: 400 });
}

/** 원인을 응답에 담지 않는다. 스택·파일 내용이 새는 가장 흔한 경로다. */
function serverError(): Response {
  return Response.json({ error: INTERNAL_ERROR_MESSAGE }, { status: 500 });
}
