"use server";

import { signIn, signOut } from "@/server/auth";
import { safeCallbackUrl } from "./callback-url";

// 폼의 callbackUrl은 클라이언트가 보낸 값이므로 서버에서 다시 검사한다.
export async function signInWithGoogle(formData: FormData): Promise<void> {
  await signIn("google", { redirectTo: safeCallbackUrl(formData.get("callbackUrl")) });
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/" });
}
