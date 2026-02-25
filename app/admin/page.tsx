"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FolderKanban, Users, Settings } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { useManageStore } from "@/app/manage/store";
import { Badge } from "@/components/ui/badge";
import { isSidebarItemVisible } from "@/lib/permissions";

export default function AdminDashboard() {
  const { t } = useTranslation();
  const selectedOrganization = useManageStore(
    (state) => state.selectedOrganization,
  );
  const currentUserRole = useManageStore((state) => state.currentUserRole);
  const orgRole = selectedOrganization?.role ?? null;

  if (!selectedOrganization) {
    return (
      <div className="p-6 lg:p-8">
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          {t("admin.overview.selectOrg", "Please select an organization")}
        </div>
      </div>
    );
  }

  const quickLinks = [
    {
      title: t("admin.sidebar.workspaces", "Workspaces"),
      description: t(
        "admin.overview.workspacesDesc",
        "Manage workspaces under this organization",
      ),
      icon: FolderKanban,
      href: "/admin/workspaces",
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-900/20",
    },
    {
      title: t("admin.sidebar.members", "Members"),
      description: t(
        "admin.overview.membersDesc",
        "Manage organization members and roles",
      ),
      icon: Users,
      href: "/admin/members",
      color: "text-green-600",
      bgColor: "bg-green-50 dark:bg-green-900/20",
    },
    {
      title: t("admin.sidebar.settings", "Settings"),
      description: t(
        "admin.overview.settingsDesc",
        "Organization name, description, and danger zone",
      ),
      icon: Settings,
      href: "/admin/settings",
      color: "text-orange-600",
      bgColor: "bg-orange-50 dark:bg-orange-900/20",
    },
  ];

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl font-bold">{selectedOrganization.name}</h1>
          {selectedOrganization.role && (
            <Badge variant="secondary">
              {t(
                `admin.organization.roles.${selectedOrganization.role}`,
                selectedOrganization.role,
              )}
            </Badge>
          )}
        </div>
        {selectedOrganization.description && (
          <p className="text-muted-foreground">
            {selectedOrganization.description}
          </p>
        )}
      </div>

      {/* Quick links */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {quickLinks
          .filter((item) =>
            isSidebarItemVisible(item.href, currentUserRole, orgRole),
          )
          .map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}>
                <Card className="cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5">
                  <CardHeader className="pb-3">
                    <div
                      className={`w-10 h-10 rounded-lg ${item.bgColor} flex items-center justify-center mb-3`}
                    >
                      <Icon className={`h-5 w-5 ${item.color}`} />
                    </div>
                    <CardTitle className="text-lg">{item.title}</CardTitle>
                    <CardDescription>{item.description}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            );
          })}
      </div>
    </div>
  );
}
