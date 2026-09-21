import { get } from "node:http";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

export function resolveRepoArg(arg, cwd) {
  return resolve(cwd, arg ?? ".");
}

export function openCommand(platform, url) {
  if (platform === "win32") return { cmd: "cmd", args: ["/c", "start", "", url] };
  if (platform === "darwin") return { cmd: "open", args: [url] };
  return { cmd: "xdg-open", args: [url] };
}

export function portInUseMessage(port) {
  return `포트 ${port}을 사용 중인 다른 프로세스를 종료한 뒤 다시 실행하세요. ` +
    "포트를 바꾸려면 Google Cloud 콘솔의 승인된 JavaScript 원본 등록도 함께 변경해야 합니다.";
}

export async function isPortFree(port) {
  return new Promise((resolveFree) => {
    const server = createServer();
    server.once("error", () => resolveFree(false));
    server.listen(port, "localhost", () => {
      server.close((error) => resolveFree(!error));
    });
  });
}

function responds(url, timeoutMs) {
  return new Promise((resolveResponse) => {
    const request = get(url, (response) => {
      // Headers are enough: do not wait for or retain the page body.
      response.destroy();
      finish(true);
    });
    // A wall-clock timer also bounds connections that never send headers.
    const timer = setTimeout(() => request.destroy(new Error("Response timed out")), timeoutMs);
    function finish(ready) {
      clearTimeout(timer);
      resolveResponse(ready);
    }
    request.once("error", () => finish(false));
  });
}

export async function waitForServer(url, timeoutMs) {
  const deadline = performance.now() + timeoutMs;
  while (performance.now() < deadline) {
    const remaining = deadline - performance.now();
    if (await responds(url, Math.min(500, remaining))) return true;
    await delay(Math.max(0, Math.min(100, deadline - performance.now())));
  }
  return false;
}
