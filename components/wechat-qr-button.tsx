"use client";
import { useEffect, useState } from "react";
import { QrCode } from "lucide-react";
import Image from "next/image";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/typography";

export interface WeChatQrButtonProps {
  label: string;
  title: string;
  description?: string;
  load: () => Promise<{ url?: string; error?: string }>;
}
/** Props-only QR display. Context wrappers key this component to cancel stale requests. */
export function WeChatQrButton({ label, title, description, load }: WeChatQrButtonProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string>();
  const [error, setError] = useState<string>();
  const [loaded, setLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(undefined); setLoaded(false); setUrl(undefined);
    load().then((result) => {
      if (cancelled) return;
      if (result.url) setUrl(result.url);
      else setError(result.error || t("workspace.qrError"));
    }).catch(() => { if (!cancelled) setError(t("workspace.qrError")); });
    return () => { cancelled = true; };
  }, [open, load, attempt, t]);
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><Button variant="ghost" size="icon" aria-label={label} title={label}><QrCode className="size-4" /></Button></PopoverTrigger>
    <PopoverContent align="end" className="w-64 p-3">
      <div className="flex flex-col items-center gap-2">
        <Text as="p" variant="bodySm" fontWeight="medium" alignment="center">{title}</Text>
        {description && <Text as="p" variant="bodyXs" tone="subdued">{description}</Text>}
        {!loaded && !error && <Skeleton className="size-56" />}
        {error ? <><Text as="p" variant="bodyXs" tone="critical" role="alert" breakWord>{error}</Text><Button size="sm" variant="outline" onClick={() => setAttempt(attempt + 1)}>{t("contentModel.action.retry")}</Button></> : url && <Image src={url} alt={label} width={224} height={224} unoptimized loading="eager" onLoad={() => setLoaded(true)} onError={() => setError(t("workspace.qrError"))} className={loaded ? "size-56 rounded" : "hidden"} />}
      </div>
    </PopoverContent>
  </Popover>;
}
