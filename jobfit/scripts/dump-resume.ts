const requiredVariables = ["NOTION_TOKEN", "NOTION_RESUME_PAGE_ID"];
const missingVariables = requiredVariables.filter((name) => !process.env[name]);

async function main(): Promise<void> {
  if (missingVariables.length > 0) {
    console.error("이력서를 읽으려면 .env.local에 아래 값을 넣어 주세요:");
    console.error("NOTION_TOKEN=");
    console.error("NOTION_RESUME_PAGE_ID=");
    process.exitCode = 1;
    return;
  }

  try {
    const { getResumeEvidence } = await import("../src/services/notion");
    const evidence = await getResumeEvidence();

    console.log(`총 ${evidence.length}개`);
    for (const [index, item] of evidence.entries()) {
      console.log(`[${index + 1}] ${item.company || "(소속 없음)"} > ${item.project}`);
      console.log(`blockId: ${item.blockId}`);
      console.log(item.text);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    console.error(`이력서 덤프에 실패했습니다: ${message}`);
    process.exitCode = 1;
  }
}

void main();
