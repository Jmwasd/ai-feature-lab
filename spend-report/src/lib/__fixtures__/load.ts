import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/** fixtures/toss-sample.csv 의 원문. 파일이 없으면 null. */
export function loadSampleCsv(): string | null {
  const samplePath = resolve(process.cwd(), "fixtures", "toss-sample.csv");

  return existsSync(samplePath) ? readFileSync(samplePath, "utf8") : null;
}
