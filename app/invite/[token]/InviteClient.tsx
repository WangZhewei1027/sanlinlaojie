"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { createClient } from "@/lib/supabase/client";
import { fetchJson } from "@/lib/fetch-json";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

type Phase = "loading" | "invalid" | "accepting" | "done";

interface Preview {
  valid: boolean;
  reason: string | null;
  role: string | null;
  organization_name: string | null;
  has_workspace: boolean;
}

export function InviteClient({ token }: { token: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [preview, setPreview] = useState<Preview | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace(`/auth/login?next=/invite/${token}`);
        return;
      }

      // 预览
      let d: Preview | null = null;
      try {
        const res = await fetch(`/api/invitations/${token}`);
        const json = await res.json();
        d = json.data as Preview;
      } catch {
        setPhase("invalid");
        return;
      }
      setPreview(d);

      if (!d?.valid) {
        setPhase("invalid");
        return;
      }

      // 自动接受
      setPhase("accepting");
      try {
        await fetchJson(`/api/invitations/${token}`, { method: "POST" });
        setPhase("done");
        setTimeout(() => router.replace("/manage"), 900);
      } catch {
        // fetchJson 已弹 toast
        setPhase("invalid");
      }
    })();
  }, [token, router]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-lg">
            {t("invite.title", "Organization Invitation")}
          </CardTitle>
          <CardDescription>
            {phase === "loading" && t("invite.loading", "Loading invitation…")}
            {phase === "invalid" &&
              (preview?.reason ??
                t("invite.invalid", "This invitation is invalid or has expired"))}
            {(phase === "accepting" || phase === "done") &&
              preview?.organization_name &&
              t("invite.joinPrompt", 'You are invited to join "{{name}}"', {
                name: preview.organization_name,
              })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(phase === "loading" || phase === "accepting") && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {phase === "loading"
                ? t("common.loading", "Loading...")
                : t("invite.joining", "Joining…")}
            </div>
          )}
          {phase === "done" && (
            <p className="text-sm text-muted-foreground">
              {t("invite.joinedRedirect", "Joined, redirecting…")}
            </p>
          )}
          {phase === "invalid" && (
            <Button variant="outline" onClick={() => router.replace("/")}>
              {t("common.backHome", "Back to Home")}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
