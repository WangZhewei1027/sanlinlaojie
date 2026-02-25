"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import {
  FolderKanban,
  Users,
  Settings,
  Trash2,
  LayoutDashboard,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";
import { useManageStore } from "@/app/manage/store";
import { isSidebarItemVisible } from "@/lib/permissions";

interface SidebarItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  section?: "org" | "global";
}

function useSidebarItems(): SidebarItem[] {
  const { t } = useTranslation();
  const currentUserRole = useManageStore((state) => state.currentUserRole);
  const selectedOrganization = useManageStore(
    (state) => state.selectedOrganization,
  );
  const orgRole = selectedOrganization?.role ?? null;

  const allItems: SidebarItem[] = [
    {
      label: t("admin.sidebar.overview", "Overview"),
      href: "/admin",
      icon: LayoutDashboard,
      section: "org",
    },
    {
      label: t("admin.sidebar.settings", "Settings"),
      href: "/admin/settings",
      icon: Settings,
      section: "org",
    },
    {
      label: t("admin.sidebar.members", "Members"),
      href: "/admin/members",
      icon: Users,
      section: "org",
    },
    {
      label: t("admin.sidebar.workspaces", "Workspaces"),
      href: "/admin/workspaces",
      icon: FolderKanban,
      section: "org",
    },
    {
      label: t("admin.sidebar.cleanup", "Cleanup"),
      href: "/admin/clean",
      icon: Trash2,
      section: "global",
    },
  ];

  return allItems.filter((item) =>
    isSidebarItemVisible(item.href, currentUserRole, orgRole),
  );
}

function SidebarNav({
  items,
  onItemClick,
}: {
  items: SidebarItem[];
  onItemClick?: () => void;
}) {
  const { t } = useTranslation();
  const pathname = usePathname();

  const orgItems = items.filter((item) => item.section === "org");
  const globalItems = items.filter((item) => item.section === "global");

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  };

  const renderItem = (item: SidebarItem) => {
    const Icon = item.icon;
    const active = isActive(item.href);

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onItemClick}
        className={cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          active
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground",
        )}
      >
        <Icon className="h-4 w-4" />
        {item.label}
      </Link>
    );
  };

  return (
    <nav className="flex flex-col gap-1">
      {/* Organization section */}
      <div className="px-3 py-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {t("admin.sidebar.orgSection", "Organization")}
        </h3>
      </div>
      {orgItems.map(renderItem)}

      {/* Separator */}
      <div className="my-2 border-t border-border" />

      {/* Global admin section */}
      <div className="px-3 py-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {t("admin.sidebar.globalSection", "Administration")}
        </h3>
      </div>
      {globalItems.map(renderItem)}
    </nav>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const items = useSidebarItems();
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 flex-shrink-0 flex-col border-r border-border bg-muted/30 p-4 overflow-y-auto">
        <SidebarNav items={items} />
      </aside>

      {/* Mobile sidebar trigger */}
      <div className="md:hidden fixed bottom-4 left-4 z-50">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button
              size="icon"
              variant="outline"
              className="rounded-full shadow-lg"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-56 p-4">
            <div className="mt-4">
              <SidebarNav
                items={items}
                onItemClick={() => setSheetOpen(false)}
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
