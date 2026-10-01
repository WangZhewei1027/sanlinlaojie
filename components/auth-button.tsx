"use client";

import Link from "next/link";
import { Button } from "./ui/button";
import { authClient } from "@/lib/auth/client";
import { LogoutButton } from "./logout-button";
import { displayAccount } from "@/lib/phone-email";

export function AuthButton() {
  // 登录态由 Better Auth 的 session store 维护，登录 / 登出后自动更新
  const { data: session } = authClient.useSession();
  const user = session?.user ?? null;

  return user ? (
    <div className="flex items-center gap-4">
      Hey, {displayAccount(user.email)}!
      <LogoutButton />
    </div>
  ) : (
    <div className="flex gap-2">
      <Button asChild size="sm" variant={"outline"}>
        <Link href="/auth/login">Sign in</Link>
      </Button>
      <Button asChild size="sm" variant={"default"}>
        <Link href="/auth/sign-up">Sign up</Link>
      </Button>
    </div>
  );
}
