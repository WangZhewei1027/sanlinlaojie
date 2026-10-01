"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LogOut, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { authClient, type SessionUser } from "@/lib/auth/client";
import { useManageStore } from "@/app/manage/store";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useModuleLinks } from "@/components/use-module-links";
import { displayAccount } from "@/lib/phone-email";

function getInitials(email: string): string {
  return email.charAt(0).toUpperCase();
}

function getDisplayName(user: SessionUser, fallback: string): string {
  return user.name || displayAccount(user.email).split("@")[0] || fallback;
}

function AvatarCircle({
  user,
  size = "md",
}: {
  user: SessionUser | null;
  size?: "sm" | "md" | "lg";
}) {
  const dim =
    size === "sm"
      ? "h-7 w-7 text-xs"
      : size === "lg"
        ? "h-10 w-10 text-base"
        : "h-8 w-8 text-sm";
  if (!user) {
    return (
      <span
        className={`${dim} rounded-full border border-border bg-muted flex items-center justify-center text-muted-foreground`}
      >
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
      </span>
    );
  }
  return (
    <span
      className={`${dim} rounded-full bg-primary text-primary-foreground flex items-center justify-center font-medium select-none`}
    >
      {getInitials(user.email || "?")}
    </span>
  );
}

export function UserAvatarMenu() {
  const { t } = useTranslation();
  // Better Auth 的 session store：登录 / 登出后自动更新
  const { data: session } = authClient.useSession();
  const user = session?.user ?? null;
  const userId = user?.id ?? null;
  const [dbName, setDbName] = useState<string | null>(null);
  const router = useRouter();
  const reset = useManageStore((state) => state.reset);
  const moduleLinks = useModuleLinks(!!user);

  // 展示名以 public.users.name 为准（设置页可改），通过 /api/users/me 读取
  useEffect(() => {
    if (!userId) {
      setDbName(null);
      return;
    }
    let active = true;
    fetch("/api/users/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (active) setDbName(json?.data?.name ?? null);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [userId]);

  const handleLogout = async () => {
    await authClient.signOut();
    reset();
    router.refresh();
    router.push("/auth/login");
  };

  if (!user) {
    return (
      <div className="flex gap-2">
        <Button asChild size="sm" variant="outline">
          <Link href="/auth/login">{t("account.signIn")}</Link>
        </Button>
        <Button asChild size="sm">
          <Link href="/auth/sign-up">{t("account.signUp")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label={t("account.userMenu")}
        >
          <AvatarCircle user={user} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-72 rounded-xl p-0 shadow-lg"
      >
        {/* Identity header */}
        <div className="px-4 py-3.5">
          <p className="text-[15px] font-semibold leading-tight truncate">
            {dbName?.trim() || getDisplayName(user, t("account.defaultName"))}
          </p>
          <p className="text-sm text-muted-foreground leading-tight mt-1 truncate">
            {displayAccount(user.email)}
          </p>
        </div>
        <DropdownMenuSeparator className="my-0" />
        {/* Module entries, gated by permission matrix */}
        {moduleLinks.length > 0 && (
          <>
            <div className="p-1.5">
              {moduleLinks.map(({ href, label, Icon }) => (
                <DropdownMenuItem
                  key={href}
                  onClick={() => router.push(href)}
                  className="cursor-pointer gap-3 rounded-lg px-2.5 py-2.5 text-[15px] [&>svg]:size-[18px] [&>svg]:text-muted-foreground"
                >
                  <Icon />
                  {label}
                </DropdownMenuItem>
              ))}
            </div>
            <DropdownMenuSeparator className="my-0" />
          </>
        )}
        {/* Actions */}
        <div className="p-1.5">
          <DropdownMenuItem
            onClick={() => router.push("/settings")}
            className="cursor-pointer gap-3 rounded-lg px-2.5 py-2.5 text-[15px] [&>svg]:size-[18px] [&>svg]:text-muted-foreground"
          >
            <Settings />
            {t("settings.title")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleLogout}
            className="cursor-pointer gap-3 rounded-lg px-2.5 py-2.5 text-[15px] text-destructive focus:text-destructive [&>svg]:size-[18px] [&>svg]:text-destructive/80"
          >
            <LogOut />
            {t("account.logout")}
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
