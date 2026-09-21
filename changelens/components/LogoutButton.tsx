"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

export function LogoutButton() {
  const pending = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function logout() {
    if (pending.current) return;
    pending.current = true;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/session", { method: "DELETE" });
      if (!response.ok && response.status !== 401) {
        setError("잠시 후 다시 로그아웃한다.");
        return;
      }
      window.location.assign("/");
    } catch {
      setError("연결을 확인하고 다시 로그아웃한다.");
    } finally {
      pending.current = false;
      setLoading(false);
    }
  }

  return (
    <div className="relative shrink-0">
      <Button variant="small" onClick={logout} disabled={loading}>로그아웃</Button>
      {error && (
        <p role="alert" className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-hairline bg-surface p-5 text-sm leading-[1.6] text-body-dim">{error}</p>
      )}
    </div>
  );
}
