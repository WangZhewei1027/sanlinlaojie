"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Settings, FolderKanban, Users, Trash2 } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "react-i18next";

export default function AdminDashboard() {
  const { t } = useTranslation();
  const modules = [
    {
      title: t("admin.dashboard.workspace.title"),
      description: t("admin.dashboard.workspace.description"),
      icon: FolderKanban,
      href: "/admin/workspace",
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: t("admin.dashboard.users.title"),
      description: t("admin.dashboard.users.description"),
      icon: Users,
      href: "/admin/users",
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: t("admin.dashboard.clean.title"),
      description: t("admin.dashboard.clean.description"),
      icon: Trash2,
      href: "/admin/clean",
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
    {
      title: t("admin.dashboard.resources.title"),
      description: t("admin.dashboard.resources.description"),
      icon: Settings,
      href: "/admin/resources",
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      disabled: true,
    },
  ];

  return (
    <div className="container mx-auto py-10 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">
          {t("admin.dashboard.title")}
        </h1>
        <p className="text-muted-foreground">{t("admin.dashboard.welcome")}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {modules.map((module) => {
          const Icon = module.icon;
          const content = (
            <Card
              className={`transition-all hover:shadow-lg ${
                module.disabled
                  ? "opacity-50 cursor-not-allowed"
                  : "cursor-pointer hover:-translate-y-1"
              }`}
            >
              <CardHeader>
                <div
                  className={`w-12 h-12 rounded-lg ${module.bgColor} flex items-center justify-center mb-4`}
                >
                  <Icon className={`h-6 w-6 ${module.color}`} />
                </div>
                <CardTitle className="flex items-center gap-2">
                  {module.title}
                  {module.disabled && (
                    <span className="text-xs text-muted-foreground font-normal">
                      ({t("admin.dashboard.comingSoon")})
                    </span>
                  )}
                </CardTitle>
                <CardDescription>{module.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {module.disabled
                    ? t("admin.dashboard.developing")
                    : t("admin.dashboard.clickToManage")}
                </p>
              </CardContent>
            </Card>
          );

          return module.disabled ? (
            <div key={module.title}>{content}</div>
          ) : (
            <Link key={module.title} href={module.href}>
              {content}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
