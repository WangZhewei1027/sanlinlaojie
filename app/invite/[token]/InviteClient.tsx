"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
          <CardTitle className="text-xl">组织邀请</CardTitle>
          <CardDescription>
            {phase === "loading" && "正在加载邀请…"}
            {phase === "invalid" &&
              (preview?.reason ?? "该邀请无效或已失效")}
            {(phase === "accepting" || phase === "done") &&
              preview?.organization_name &&
              `你被邀请加入「${preview.organization_name}」`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(phase === "loading" || phase === "accepting") && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {phase === "loading" ? "加载中…" : "正在加入…"}
            </div>
          )}
          {phase === "done" && (
            <p className="text-sm text-muted-foreground">
              已加入，正在跳转…
            </p>
          )}
          {phase === "invalid" && (
            <Button variant="outline" onClick={() => router.replace("/")}>
              返回首页
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
