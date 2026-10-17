"use client";

import { useSearchParams } from "next/navigation";
import { teamHref } from "../lib/content-context";
import { RouteRedirect } from "./RouteRedirect";

/**
 * Old /manage/assets and /manage/scenes URLs: the workbench, filtered when the
 * old page was type-specific. The team parameter survives; a legacy
 * `workspaceId` is dropped because content no longer belongs to one.
 */
export function WorkbenchAlias({ type }: { type?: "scene" }) {
  const organizationId = useSearchParams().get("organizationId");
  return <RouteRedirect to={teamHref("/manage", organizationId, type ? { type } : undefined)} />;
}
