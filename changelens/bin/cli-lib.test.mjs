import { createServer as createHttpServer } from "node:http";
import { createServer as createTcpServer } from "node:net";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  isPortFree, openCommand, portInUseMessage, resolveRepoArg, waitForServer,
} from "./cli-lib.mjs";

const servers = [];

async function listen(server, port = 0) {
  servers.push(server);
  await new Promise((resolveListening, reject) => {
    server.once("error", reject);
    server.listen(port, "localhost", () => {
      server.removeListener("error", reject);
      resolveListening();
    });
  });
  return server.address().port;
}

function close(server) {
  return new Promise((resolveClosed, reject) => {
    server.close((error) => error ? reject(error) : resolveClosed());
    server.closeAllConnections?.();
  });
}

afterEach(async () => {
  await Promise.all(servers.splice(0).filter((server) => server.listening).map(close));
});

describe("resolveRepoArg", () => {
  const cwd = resolve("cli fixture");

  it("uses cwd when no argument is supplied", () => {
    expect(resolveRepoArg(undefined, cwd)).toBe(cwd);
  });

  it("resolves a relative path with spaces and Korean characters against cwd", () => {
    expect(resolveRepoArg("../문서 저장소", cwd)).toBe(join(cwd, "..", "문서 저장소"));
  });

  it("preserves an absolute path regardless of cwd", () => {
    const repo = resolve("별도 저장소");
    expect(resolveRepoArg(repo, cwd)).toBe(repo);
  });
});

describe("openCommand", () => {
  const url = "http://localhost:3000";

  it.each([
    ["win32", { cmd: "cmd", args: ["/c", "start", "", url] }],
    ["darwin", { cmd: "open", args: [url] }],
    ["linux", { cmd: "xdg-open", args: [url] }],
    ["freebsd", { cmd: "xdg-open", args: [url] }],
  ])("returns the executable and argument array for %s", (platform, expected) => {
    expect(openCommand(platform, url)).toEqual(expected);
  });
});

describe("portInUseMessage", () => {
  it("names the occupied port and explains process shutdown and Google Cloud origins", () => {
    const message = portInUseMessage(3456);
    expect(message).toContain("3456");
    expect(message).toMatch(/프로세스.*(종료|끄)/);
    expect(message).toContain("Google Cloud 콘솔");
    expect(message).toContain("원본");
    expect(message).toMatch(/포트.*(바꾸|변경)/);
  });
});

describe("isPortFree", () => {
  it("detects an occupied port and releases its own probe after the port becomes free", async () => {
    const server = createTcpServer();
    const port = await listen(server);
    expect(await isPortFree(port)).toBe(false);
    await close(server);
    expect(await isPortFree(port)).toBe(true);
    // A fresh listener must be able to bind immediately after the probe.
    await listen(createTcpServer(), port);
  });
});

describe("waitForServer", () => {
  it("returns true when an HTTP server responds", async () => {
    const port = await listen(createHttpServer((_request, response) => response.end("ready")));
    expect(await waitForServer(`http://localhost:${port}`, 1000)).toBe(true);
  });

  it("accepts an HTTP response even when its status is not 200", async () => {
    const port = await listen(createHttpServer((_request, response) => {
      response.writeHead(503).end("not ready");
    }));
    expect(await waitForServer(`http://localhost:${port}`, 1000)).toBe(true);
  });

  it("returns false within a short deadline when no server is listening", async () => {
    const server = createTcpServer();
    const port = await listen(server);
    await close(server);
    const start = performance.now();
    expect(await waitForServer(`http://localhost:${port}`, 120)).toBe(false);
    expect(performance.now() - start).toBeLessThan(1000);
  });

  it("retries when the server drops the first connection", async () => {
    let requests = 0;
    const port = await listen(createHttpServer((request, response) => {
      requests += 1;
      if (requests === 1) request.socket.destroy();
      else response.end("ready");
    }));
    expect(await waitForServer(`http://localhost:${port}`, 1000)).toBe(true);
    expect(requests).toBe(2);
  });

  it("enforces the deadline even when a connection never responds", async () => {
    const port = await listen(createHttpServer(() => {}));
    const start = performance.now();
    expect(await waitForServer(`http://localhost:${port}`, 120)).toBe(false);
    expect(performance.now() - start).toBeLessThan(1000);
  });
});
