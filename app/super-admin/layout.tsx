"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import {
  Users,
  Building2,
  Shield,
  Menu,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { isSuperAdmin } from "@/lib/permissions";

interface SidebarItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
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

  const isActive = (href: string) => {
    if (href === "/super-admin/users") {
      return pathname === "/super-admin" || pathname === "/super-admin/users";
    }
    return pathname.startsWith(href);
  };

  return (
    <nav className="flex flex-col gap-1">
      <div className="px-3 py-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {t("superAdmin.sidebar.section", "Super Admin")}
        </h3>
      </div>
      {items.map((item) => {
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
      })}
    </nav>
  );
}

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    fetch("/api/auth/role")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isSuperAdmin(data?.role)) {
          router.replace("/403");
          return;
        }
        setAuthorized(true);
      })
      .catch(() => router.replace("/403"))
      .finally(() => setLoading(false));
  }, [router]);

  const items: SidebarItem[] = [
    {
      label: t("superAdmin.sidebar.users", "User Management"),
      href: "/super-admin/users",
      icon: Users,
    },
    {
      label: t("superAdmin.sidebar.organizations", "Organizations"),
      href: "/super-admin/organizations",
      icon: Building2,
    },
  ];

  if (loading || !authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 flex-shrink-0 flex-col border-r border-border bg-muted/30 p-4 overflow-y-auto">
        {/* Back to home */}
        <Button
          variant="ghost"
          size="sm"
          className="mb-4 justify-start"
          onClick={() => router.push("/")}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          {t("common.back", "Back")}
        </Button>

        {/* Title */}
        <div className="flex items-center gap-2 px-3 mb-4">
          <Shield className="h-5 w-5" />
          <span className="font-semibold text-sm">
            {t("superAdmin.title", "Super Admin")}
          </span>
        </div>

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
              <Button
                variant="ghost"
                size="sm"
                className="mb-4 justify-start"
                onClick={() => router.push("/")}
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                {t("common.back", "Back")}
              </Button>

              <div className="flex items-center gap-2 px-3 mb-4">
                <Shield className="h-5 w-5" />
                <span className="font-semibold text-sm">
                  {t("superAdmin.title", "Super Admin")}
                </span>
              </div>

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
