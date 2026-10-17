"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, Clapperboard, MapPinned } from "lucide-react";
import { cn } from "@/lib/utils";
import { contextHref } from "../lib/content-context";
import { useIntegrationText, type IntegrationTexts } from "../lib/integration-text";

const TEXTS: IntegrationTexts = {
  "contentModel.integration.nav.label": ["内容管理", "Content"],
  "contentModel.integration.nav.assets": ["素材库", "Asset library"],
  "contentModel.integration.nav.scenes": ["场景", "Scenes"],
  "contentModel.integration.nav.map": ["投放地图", "Placement map"],
};

const ITEMS = [
  { href: "/manage/assets", key: "assets", icon: Boxes },
  { href: "/manage/scenes", key: "scenes", icon: Clapperboard },
  { href: "/manage", key: "map", icon: MapPinned },
] as const;

/**
 * Section switcher for the three content surfaces. Links keep the explicit
 * organization/project so a tab or shared URL opens the same context.
 */
export function ContentNav({ organizationId, workspaceId, className }: { organizationId?: string | null; workspaceId?: string | null; className?: string }) {
  const tx = useIntegrationText(TEXTS);
  const pathname = usePathname();
  const active = (href: string) => (href === "/manage" ? pathname === "/manage" : pathname === href || pathname.startsWith(`${href}/`));
  return (
    <nav aria-label={tx("contentModel.integration.nav.label")} className={cn("flex items-center gap-1 overflow-x-auto", className)}>
      {ITEMS.map(({ href, key, icon: Icon }) => (
        <Link
          key={href}
          href={contextHref(href, { organizationId, workspaceId })}
          aria-current={active(href) ? "page" : undefined}
          className={cn(
            "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            active(href) ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground",
          )}
        >
          <Icon className="size-4" aria-hidden />
          {tx(`contentModel.integration.nav.${key}`)}
        </Link>
      ))}
    </nav>
  );
}
