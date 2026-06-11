"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { LogOut, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { EnvVarWarning } from "@/components/env-var-warning";
import { createClient } from "@/lib/supabase/client";
import { useManageStore } from "@/app/manage/store";
import { hasEnvVars } from "@/lib/utils";

function getInitials(email: string): string {
  return email.charAt(0).toUpperCase();
}

function getDisplayName(user: User, fallback: string): string {
  const meta = user.user_metadata ?? {};
  return (
    (meta.full_name as string) ||
    (meta.name as string) ||
    (meta.user_name as string) ||
    (user.email ? user.email.split("@")[0] : fallback)
  );
}

export function NavbarSidebar() {
  const { t } = useTranslation();
  const [user, setUser] = useState<User | null>(null);
  const supabase = createClient();
  const router = useRouter();
  const reset = useManageStore((state) => state.reset);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    reset();
    router.refresh();
    router.push("/auth/login");
  };

  return (
    <Drawer>
      <DrawerTrigger asChild>
        <button
          className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label={t("account.userMenu")}
        >
          {user ? (
            <span className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium select-none">
              {getInitials(user.email ?? "?")}
            </span>
          ) : (
            <span className="h-8 w-8 rounded-full border border-border bg-muted flex items-center justify-center text-muted-foreground">
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
          )}
        </button>
      </DrawerTrigger>
      <DrawerContent>
        <div className="px-5 pt-5 pb-2">
          {!hasEnvVars ? (
            <EnvVarWarning />
          ) : user ? (
            <div className="flex flex-col gap-5">
              {/* User info */}
              <div className="flex items-center gap-4">
                <span className="h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-lg font-semibold select-none flex-shrink-0">
                  {getInitials(user.email ?? "?")}
                </span>
                <div className="min-w-0">
                  <p className="text-base font-semibold truncate leading-tight">
                    {getDisplayName(user, t("account.defaultName"))}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1 truncate leading-tight">
                    {user.email}
                  </p>
                </div>
              </div>
              {/* Actions */}
              <div className="flex flex-col gap-2">
                <DrawerClose asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2"
                    onClick={() => router.push("/settings")}
                  >
                    <Settings className="h-4 w-4" />
                    {t("settings.title")}
                  </Button>
                </DrawerClose>
                <DrawerClose asChild>
                  <Button
                    variant="destructive"
                    className="w-full justify-start gap-2"
                    onClick={handleLogout}
                  >
                    <LogOut className="h-4 w-4" />
                    {t("account.logout")}
                  </Button>
                </DrawerClose>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                {t("account.signInPrompt")}
              </p>
              <DrawerClose asChild>
                <Button asChild className="w-full">
                  <Link href="/auth/login">{t("account.signIn")}</Link>
                </Button>
              </DrawerClose>
              <DrawerClose asChild>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/auth/sign-up">{t("account.signUp")}</Link>
                </Button>
              </DrawerClose>
            </div>
          )}
        </div>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="outline">{t("common.close")}</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
