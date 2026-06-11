"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Check, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function SettingsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [initialName, setInitialName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth/login");
        return;
      }
      try {
        const res = await fetch("/api/users/me");
        if (!res.ok) throw new Error();
        const { data } = await res.json();
        if (!active) return;
        setEmail(data?.email ?? user.email ?? "");
        setName(data?.name ?? "");
        setInitialName(data?.name ?? "");
      } catch {
        if (active) setError(t("settings.loadError"));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [supabase.auth, router, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t("settings.nameRequired"));
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "");
      setName(json.data?.name ?? trimmed);
      setInitialName(json.data?.name ?? trimmed);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : t("settings.saveError"),
      );
    } finally {
      setSaving(false);
    }
  };

  const dirty = name.trim() !== initialName.trim();

  return (
    <main className="flex-1 w-full flex justify-center px-4 py-10">
      <div className="w-full max-w-xl flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("settings.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("settings.subtitle")}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("settings.profile")}</CardTitle>
            <CardDescription>{t("settings.profileDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("common.loading")}
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">{t("settings.email")}</Label>
                  <Input
                    id="email"
                    value={email}
                    disabled
                    className="bg-muted/50"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("settings.emailHint")}
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="name">{t("settings.name")}</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setError(null);
                    }}
                    maxLength={50}
                    placeholder={t("settings.namePlaceholder")}
                    autoComplete="name"
                  />
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <div className="flex items-center gap-3">
                  <Button type="submit" disabled={saving || !dirty}>
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    {t("common.save")}
                  </Button>
                  {saved && (
                    <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-500">
                      <Check className="h-4 w-4" />
                      {t("settings.saved")}
                    </span>
                  )}
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
