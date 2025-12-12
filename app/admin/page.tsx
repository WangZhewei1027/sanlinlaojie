import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Settings, FolderKanban, Users } from "lucide-react";
import Link from "next/link";

export default async function AdminDashboard() {
  const modules = [
    {
      title: "Workspace 管理",
      description: "创建、编辑和删除工作空间，管理区域限制和地图模型",
      icon: FolderKanban,
      href: "/admin/workspace",
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "用户管理",
      description: "管理用户权限，分配工作空间访问权限",
      icon: Users,
      href: "/admin/users",
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "资源管理",
      description: "管理所有工作空间下的资源和资产",
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
        <h1 className="text-3xl font-bold mb-2">管理后台</h1>
        <p className="text-muted-foreground">
          欢迎回来！这里可以管理系统的各个模块。
        </p>
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
                      (即将推出)
                    </span>
                  )}
                </CardTitle>
                <CardDescription>{module.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {module.disabled ? "功能开发中..." : "点击进入管理"}
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
