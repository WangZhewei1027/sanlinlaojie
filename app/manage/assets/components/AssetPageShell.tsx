"use client";

import type { ReactNode } from "react";
import { ContentNav } from "@/app/manage/components/ContentNav";
import { ContentListSkeleton } from "@/app/manage/content";

/** Console frame shared by the library and detail routes: section tabs, then the page. */
export function AssetPageShell({
  organizationId,
  workspaceId,
  aside,
  children,
}: {
  organizationId: string | null;
  workspaceId: string | null;
  /** Right side of the navigation row (back link, secondary actions). */
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <ContentNav organizationId={organizationId} workspaceId={workspaceId} />
        {aside && <div className="flex flex-wrap items-center gap-2">{aside}</div>}
      </div>
      {children}
    </main>
  );
}

export function AssetPageLoading({ label }: { label: string }) {
  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      <ContentListSkeleton label={label} />
    </div>
  );
}
