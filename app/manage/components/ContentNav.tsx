"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, MapPinned, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { teamHref } from "../lib/content-context";
import { useIntegrationText, type IntegrationTexts } from "../lib/integration-text";

export const NAV_TEXTS: IntegrationTexts = {
  "contentModel.integration.nav.label": ["团队导航", "Team navigation"],
  "contentModel.integration.nav.workbench": ["工作台", "Workbench"],
  "contentModel.integration.nav.collections": ["合集", "Collections"],
  "contentModel.integration.nav.settings": ["团队设置", "Team settings"],
};

const WORKBENCH_PATHS = ["/manage/assets", "/manage/scenes"];

const ITEMS = [
  { href: "/manage", key: "workbench", icon: LayoutGrid, active: (path: string) => path === "/manage" || WORKBENCH_PATHS.some((prefix) => path === prefix || path.startsWith(`${prefix}/`)) },
  { href: "/manage/collections", key: "collections", icon: MapPinned, active: (path: string) => path === "/manage/collections" || path.startsWith("/manage/collections/") },
  { href: "/admin", key: "settings", icon: Settings2, active: (path: string) => path === "/admin" || path.startsWith("/admin/") },
] as const;

/**
 * Primary navigation of the team console: 工作台 / 合集 / 团队设置. Links
 * carry only the team, never a workspace, so a shared URL opens the same team.
 */
export function ContentNav({ organizationId, showSettings = true, className }: { organizationId?: string | null; showSettings?: boolean; className?: string }) {
  const tx = useIntegrationText(NAV_TEXTS);
  const pathname = usePathname() ?? "";
  const items = ITEMS.filter((item) => showSettings || item.key !== "settings");
  return (
    <nav aria-label={tx("contentModel.integration.nav.label")} className={cn("flex items-center gap-1 overflow-x-auto", className)}>
      {items.map(({ href, key, icon: Icon, active }) => {
        const current = active(pathname);
        return (
          <Link
            key={href}
            href={key === "settings" ? href : teamHref(href, organizationId)}
            aria-current={current ? "page" : undefined}
            className={cn(
              "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              current ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {tx(`contentModel.integration.nav.${key}`)}
          </Link>
        );
      })}
    </nav>
  );
}
