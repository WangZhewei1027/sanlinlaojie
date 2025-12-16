import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center">
      <div className="flex-1 w-full flex flex-col gap-20 items-center">
        <div className="flex-1 flex flex-col gap-20 max-w-5xl p-5 w-full">
          <main className="flex-1 flex flex-col gap-6 px-4">
            {/* Hero Section */}
            <section className="flex flex-col items-center text-center gap-6 pt-16 pb-8">
              <h1 className="text-5xl font-bold tracking-tight">
                三林老街数字化平台
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl">
                基于 3D 地图和 Web AR 技术的文化遗产数字化采集与展示平台
              </p>
              <div className="flex gap-4 mt-4">
                <Button asChild size="lg">
                  <Link href="/auth/login">开始使用</Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/manage">浏览地图</Link>
                </Button>
              </div>
            </section>

            {/* Features Section */}
            <section className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 py-12">
              <Card>
                <CardHeader>
                  <CardTitle>3D 地图展示</CardTitle>
                  <CardDescription>
                    基于 CesiumJS 的三维地图可视化
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    高精度 3D
                    地图展示三林老街的地理信息，支持多角度浏览和交互操作。
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>现场采集</CardTitle>
                  <CardDescription>基于 GPS 定位的实地数据采集</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    通过移动设备在现场拍摄照片、录制视频，自动关联地理位置信息。
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Web AR 体验</CardTitle>
                  <CardDescription>基于 Zappar 的增强现实</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    通过手机浏览器即可体验 AR
                    内容，无需安装额外应用，让历史文化活起来。
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>资源管理</CardTitle>
                  <CardDescription>便捷的数字资产管理系统</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    支持照片、视频、音频等多种格式，提供分类、标签、搜索等管理功能。
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>协作工作区</CardTitle>
                  <CardDescription>多人协作的工作空间</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    管理员可创建工作区并分配权限，学生可在指定区域内进行采集和管理。
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>成果展示</CardTitle>
                  <CardDescription>多维度的展示平台</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    采集成果可在地图上可视化展示，支持时间轴、分类筛选等多种浏览方式。
                  </p>
                </CardContent>
              </Card>
            </section>

            {/* Tech Stack Section */}
            <section className="flex flex-col items-center gap-6 py-12">
              <h2 className="text-3xl font-bold">技术架构</h2>
              <div className="flex flex-wrap justify-center gap-3">
                <span className="px-4 py-2 bg-primary/10 rounded-full text-sm font-medium">
                  Next.js
                </span>
                <span className="px-4 py-2 bg-primary/10 rounded-full text-sm font-medium">
                  Supabase
                </span>
                <span className="px-4 py-2 bg-primary/10 rounded-full text-sm font-medium">
                  CesiumJS
                </span>
                <span className="px-4 py-2 bg-primary/10 rounded-full text-sm font-medium">
                  OpenStreetMap
                </span>
                <span className="px-4 py-2 bg-primary/10 rounded-full text-sm font-medium">
                  Zappar WebAR
                </span>
                <span className="px-4 py-2 bg-primary/10 rounded-full text-sm font-medium">
                  Shadcn UI
                </span>
                <span className="px-4 py-2 bg-primary/10 rounded-full text-sm font-medium">
                  TailwindCSS
                </span>
              </div>
            </section>

            {/* Quick Links */}
            <section className="flex flex-col items-center gap-6 py-12">
              <h2 className="text-3xl font-bold">快速入口</h2>
              <div className="grid md:grid-cols-2 gap-4 w-full max-w-2xl">
                <Button asChild variant="outline" className="h-auto py-6">
                  <Link href="/upload-onsite" className="flex flex-col gap-2">
                    <span className="text-lg font-semibold">现场上传</span>
                    <span className="text-sm text-muted-foreground font-normal">
                      基于 GPS 定位的现场采集
                    </span>
                  </Link>
                </Button>
                <Button asChild variant="outline" className="h-auto py-6">
                  <Link href="/manage" className="flex flex-col gap-2">
                    <span className="text-lg font-semibold">资源管理</span>
                    <span className="text-sm text-muted-foreground font-normal">
                      管理和编辑已采集的资源
                    </span>
                  </Link>
                </Button>
                <Button asChild variant="outline" className="h-auto py-6">
                  <Link href="/ar" className="flex flex-col gap-2">
                    <span className="text-lg font-semibold">AR 体验</span>
                    <span className="text-sm text-muted-foreground font-normal">
                      增强现实内容浏览
                    </span>
                  </Link>
                </Button>
                <Button asChild variant="outline" className="h-auto py-6">
                  <Link href="/admin" className="flex flex-col gap-2">
                    <span className="text-lg font-semibold">管理后台</span>
                    <span className="text-sm text-muted-foreground font-normal">
                      工作区和用户管理（需管理员权限）
                    </span>
                  </Link>
                </Button>
              </div>
            </section>
          </main>
        </div>

        <footer className="w-full flex items-center justify-center border-t mx-auto text-center text-xs gap-8 py-16">
          <p className="text-muted-foreground">
            三林老街数字化平台. All rights reserved.
          </p>
        </footer>
      </div>
    </main>
  );
}
