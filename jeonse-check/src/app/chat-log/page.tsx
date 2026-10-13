import type { Metadata } from "next";
import { AuthTopNav } from "@/features/auth/AuthTopNav";
import { ChatLog, type ChatLogData } from "./_components/ChatLog";
import chatLog from "./_data/chat-log.json";

export const metadata: Metadata = { title: "채팅 로그 | jeonse-check" };

// 데이터는 손으로 고치지 않는다. chat-logs 스킬로 다시 만든다:
// python3 .claude/skills/chat-logs/build_chat_logs.py jeonse-check --json jeonse-check/src/app/chat-log/_data/chat-log.json
export default function ChatLogPage() {
  return (
    <>
      <AuthTopNav links={[]} />
      <main>
        <ChatLog data={chatLog satisfies ChatLogData} />
      </main>
    </>
  );
}
