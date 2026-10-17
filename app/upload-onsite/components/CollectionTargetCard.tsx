"use client";

import Link from "next/link";
import { useId } from "react";
import { AlertTriangle, MapPinned } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Text } from "@/components/ui/typography";
import { OrgSwitcher } from "@/components/org-switcher";
import { cn } from "@/lib/utils";
import type { IntegrationT } from "@/app/manage/lib/integration-text";

export interface CollectionTargetCardProps {
  tx: IntegrationT;
  status: "idle" | "loading" | "ready" | "error";
  error?: string | null;
  onRetry: () => void;
  collections: { id: string; name: string }[];
  /** The chosen map collection; null asks the user to pick one. */
  value: string | null;
  /** The link named a collection that is archived or no longer exists. */
  linkedInvalid?: boolean;
  onChange: (collectionId: string) => void;
  /** Where to create the team's first collection. */
  createHref: string;
}

/**
 * Where an onsite capture is placed: the team (header switcher) and one map
 * collection picked here. The choice is local to this page; nothing else in
 * the console depends on it.
 */
export function CollectionTargetCard({ tx, status, error, onRetry, collections, value, linkedInvalid, onChange, createHref }: CollectionTargetCardProps) {
  const id = useId();
  const needsSelection = status === "ready" && !value;
  return (
    <Card className={cn("space-y-3 p-4", needsSelection && "border-warning/60 bg-warning/10")}>
      <div className="flex items-center gap-2">
        <MapPinned className="size-4 text-muted-foreground" aria-hidden />
        <Text as="h2" variant="bodySm" fontWeight="medium">{tx("contentModel.integration.onsite.target.title")}</Text>
      </div>
      <div className="flex min-w-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center">
        <OrgSwitcher className="w-full min-w-0 max-w-full justify-start sm:w-auto sm:max-w-none sm:flex-1 [&>span]:flex-1 [&>span]:text-left" />
        <div className="min-w-0 sm:flex-1">
          <Label htmlFor={id} className="sr-only">{tx("contentModel.integration.onsite.target.collection")}</Label>
          <Select value={value ?? ""} onValueChange={onChange} disabled={status !== "ready" || collections.length === 0}>
            <SelectTrigger id={id} className="w-full">
              <SelectValue placeholder={tx(status === "loading" ? "contentModel.integration.onsite.target.loading" : "contentModel.integration.onsite.target.placeholder")} />
            </SelectTrigger>
            <SelectContent>
              {collections.map((collection) => <SelectItem key={collection.id} value={collection.id}>{collection.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      {status === "error" && (
        <div className="flex flex-wrap items-center gap-2">
          <Text as="p" variant="bodySm" tone="critical">{error || tx("contentModel.integration.onsite.target.loadFailed")}</Text>
          <Button variant="outline" size="sm" onClick={onRetry}>{tx("contentModel.action.retry")}</Button>
        </div>
      )}
      {status === "ready" && collections.length === 0 ? (
        <Text as="p" variant="bodySm" tone="subdued">
          {tx("contentModel.integration.onsite.target.none")}{" "}
          <Link href={createHref} className="text-primary underline-offset-4 hover:underline">{tx("contentModel.integration.onsite.target.create")}</Link>
        </Text>
      ) : needsSelection && (
        <p role={linkedInvalid ? "alert" : undefined} className="flex items-start gap-2 text-sm text-warning">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{tx(linkedInvalid ? "contentModel.integration.onsite.target.linkedInvalid" : "contentModel.integration.onsite.target.required")}</span>
        </p>
      )}
    </Card>
  );
}
