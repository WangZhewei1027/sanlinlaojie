"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, MapPinned } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/typography";
import { ContentStatusBadge } from "./ContentStatusBadge";

export interface CollectionHeaderBarProps {
  /** Null while the collection is loading. */
  name: string | null;
  archived?: boolean;
  backHref: string;
  /** Right side: the collection's mini-program QR code and secondary actions. */
  actions?: ReactNode;
}

/** Thin bar above the map: where the user is, how to get back, the collection QR. */
export function CollectionHeaderBar({ name, archived, backHref, actions }: CollectionHeaderBarProps) {
  const { t } = useTranslation();
  return (
    <div className="flex h-11 shrink-0 items-center gap-2 border-b bg-background px-2 sm:px-3">
      <Button variant="ghost" size="sm" asChild className="shrink-0 px-2">
        <Link href={backHref}><ChevronLeft aria-hidden /><span className="max-sm:sr-only">{t("contentModel.collections.title")}</span></Link>
      </Button>
      <span className="h-4 border-l" aria-hidden />
      <MapPinned className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <Text as="h1" variant="bodySm" fontWeight="semibold" truncate className="min-w-0" title={name ?? undefined}>
        {name ?? t("contentModel.state.loading")}
      </Text>
      {archived && <ContentStatusBadge kind="archived" className="shrink-0" />}
      <div className="ms-auto flex shrink-0 items-center gap-1">{actions}</div>
    </div>
  );
}
