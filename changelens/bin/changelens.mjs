#!/usr/bin/env node
import { execFile, spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { createRequire } from "node:module";
import { constants } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  isPortFree, openCommand, portInUseMessage, resolveRepoArg, waitForServer,
} from "./cli-lib.mjs";

const port = 3000;
const url = `http://localhost:${port}`;
const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));

async function main() {
  const repoPath = resolveRepoArg(process.argv[2], process.cwd());
  try {
    await promisify(execFile)("git", ["rev-parse", "--git-dir"], { cwd: repoPath });
  } catch (error) {
    console.warn(`경고: git 저장소를 확인할 수 없습니다: ${repoPath}`);
    console.warn((error.stderr || error.message).split(/\r?\n/, 1)[0]);
  }

  if (!(await isPortFree(port))) {
    console.error(portInUseMessage(port));
    process.exitCode = 1;
    return;
  }

  try {
    await access(join(packageRoot, ".next", "BUILD_ID"));
  } catch {
    console.error(`빌드 결과가 없습니다. ${packageRoot}에서 npm run build를 먼저 실행하세요.`);
    process.exitCode = 1;
    return;
  }

  const nextBin = createRequire(import.meta.url).resolve("next/dist/bin/next");
  const child = spawn(process.execPath, [nextBin, "start", "-p", String(port), "-H", "localhost"], {
    cwd: packageRoot,
    env: { ...process.env, CHANGELENS_REPO: repoPath },
    stdio: "inherit",
  });
  process.on("SIGINT", () => child.kill("SIGINT"));
  process.on("SIGTERM", () => child.kill("SIGTERM"));
  child.once("error", (error) => {
    console.error(`서버를 시작할 수 없습니다: ${error.message}`);
    process.exit(1);
  });
  child.once("exit", (code, signal) => {
    // Exit immediately if startup fails instead of waiting for the readiness deadline.
    process.exit(code ?? (signal ? 128 + constants.signals[signal] : 1));
  });

  if (!(await waitForServer(url, 30_000))) {
    console.log(url);
    return;
  }

  const { cmd, args } = openCommand(process.platform, url);
  execFile(cmd, args, (error) => {
    if (error) console.log(url);
  });
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
