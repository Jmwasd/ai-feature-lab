import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // next dev가 CLAUDE.md에 Next.js 에이전트 규칙 블록을 끼워 넣지 않게 한다.
  agentRules: false,
};

export default nextConfig;
