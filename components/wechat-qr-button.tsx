"use client";
import { useEffect, useRef, useState } from "react";
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
  /** An overlay host in the same document and theme as the trigger. */
  portalContainer?: HTMLElement | null;
}
/** Props-only QR display. Context wrappers key this component to cancel stale requests. */
export function WeChatQrButton({ label, title, description, load, portalContainer }: WeChatQrButtonProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string>();
  const [error, setError] = useState<string>();
  const [loaded, setLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const dismissedInViewport = useRef(false);
  useEffect(() => {
    if (!open || !portalContainer || portalContainer.ownerDocument === document) return;
    // Events in the editor iframe do not bubble to the portalled popover's document.
    const close = () => { dismissedInViewport.current = true; setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, [open, portalContainer]);
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
    <PopoverContent ref={contentRef} portalContainer={portalContainer} aria-label={title} align="end" sideOffset={10} collisionPadding={12} className="w-72 max-w-[calc(100vw-24px)] max-h-[var(--radix-popover-content-available-height)] overflow-y-auto p-4" onOpenAutoFocus={(event) => { event.preventDefault(); contentRef.current?.focus(); }} onCloseAutoFocus={(event) => { if (dismissedInViewport.current) event.preventDefault(); dismissedInViewport.current = false; }}>
      <div className="flex flex-col items-center gap-2">
        <Text as="p" variant="bodySm" fontWeight="medium" alignment="center">{title}</Text>
        {description && <Text as="p" variant="bodySm" tone="subdued">{description}</Text>}
        {!loaded && !error && <Skeleton className="size-56" />}
        {error ? <><Text as="p" variant="bodySm" tone="critical" role="alert" breakWord>{error}</Text><Button size="sm" variant="outline" onClick={() => setAttempt(attempt + 1)}>{t("contentModel.action.retry")}</Button></> : url && <Image src={url} alt={label} width={224} height={224} unoptimized loading="eager" onLoad={() => setLoaded(true)} onError={() => setError(t("workspace.qrError"))} className={loaded ? "size-56 max-w-full rounded" : "hidden"} />}
      </div>
    </PopoverContent>
  </Popover>;
}
