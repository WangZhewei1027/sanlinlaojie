"use client";

import Link from "next/link";
import { CheckCircle2, MapPinned, Package } from "lucide-react";
import type { CreatePlacementResult, GeoPointInput } from "@/lib/content-model/contracts";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/typography";
import { contextHref } from "@/app/manage/lib/content-context";
import { useIntegrationText } from "@/app/manage/lib/integration-text";
import { ONSITE_TEXTS } from "../onsite-texts";

export interface OnsiteReceipt {
  result: CreatePlacementResult;
  organizationId: string | null;
  workspaceId: string;
  projectName: string | null;
  /** Location that was submitted; shown when the response carries none. */
  submittedLocation: GeoPointInput;
}

/** Result of one "upload and place": fixed version, placement ids and where to go next. */
export function UploadReceiptCard({ receipt, onDismiss }: { receipt: OnsiteReceipt; onDismiss: () => void }) {
  const tx = useIntegrationText(ONSITE_TEXTS);
  const { result, organizationId, workspaceId } = receipt;
  const { placement, asset, version } = result;
  const location = placement.location ?? receipt.submittedLocation;
  const context = { organizationId, workspaceId };
  const rows: { label: string; value: string; mono?: boolean }[] = [
    { label: tx("contentModel.integration.onsite.receipt.asset"), value: asset?.name || placement.name || tx("contentModel.integration.onsite.receipt.untitled") },
    ...(version ? [{ label: tx("contentModel.integration.onsite.receipt.version"), value: `v${version.version_no}` }] : []),
    { label: tx("contentModel.integration.onsite.receipt.project"), value: placement.workspace_name || receipt.projectName || workspaceId },
    {
      label: tx("contentModel.integration.onsite.receipt.location"),
      value: tx("contentModel.integration.onsite.location.coords", { lon: location.longitude.toFixed(6), lat: location.latitude.toFixed(6) }),
    },
    { label: tx("contentModel.integration.onsite.receipt.placementId"), value: placement.id, mono: true },
    { label: tx("contentModel.integration.onsite.receipt.publicId"), value: placement.public_id, mono: true },
  ];

  return (
    <Card role="status" className="space-y-3 border-success/30 p-4">
      <div className="flex items-start gap-2">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
        <div className="min-w-0 space-y-0.5">
          <Text as="h2" variant="bodyMd" fontWeight="semibold">
            {tx("contentModel.integration.onsite.receipt.title")}
          </Text>
          {!result.created && (
            <Text as="p" variant="bodySm" tone="subdued">
              {tx("contentModel.integration.onsite.receipt.replayed")}
            </Text>
          )}
        </div>
      </div>

      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="contents">
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className={row.mono ? "break-all font-mono text-xs leading-5" : "break-words"}>{row.value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href={contextHref("/manage", context, { placementId: placement.id })}>
            <MapPinned aria-hidden />
            {tx("contentModel.integration.onsite.receipt.openMap")}
          </Link>
        </Button>
        {asset && (
          <Button asChild variant="outline" size="sm">
            <Link href={contextHref(`/manage/assets/${encodeURIComponent(asset.id)}`, context)}>
              <Package aria-hidden />
              {tx("contentModel.integration.onsite.receipt.openAsset")}
            </Link>
          </Button>
        )}
        <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>
          {tx("contentModel.integration.onsite.receipt.dismiss")}
        </Button>
      </div>
    </Card>
  );
}
