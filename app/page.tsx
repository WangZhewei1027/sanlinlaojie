import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center">
      <div className="flex-1 w-full flex flex-col gap-20 items-center">
        <div className="flex-1 flex flex-col gap-20 max-w-5xl p-5 w-full">
          <main className="flex-1 flex flex-col gap-6 px-4">
            {/* Hero Title */}
            <section className="flex flex-col items-center gap-4 pt-12">
              <h1 className="text-4xl md:text-5xl font-bold text-center">
                A Letter to the Future
              </h1>
              <p className="text-sm md:text-base text-muted-foreground text-center">
                Experience studio, IMA, CEL, DHL, NYU Shanghai
              </p>
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
                {/* <Button asChild variant="outline" className="h-auto py-6">
                  <Link href="/ar" className="flex flex-col gap-2">
                    <span className="text-lg font-semibold">AR 体验</span>
                    <span className="text-sm text-muted-foreground font-normal">
                      增强现实内容浏览
                    </span>
                  </Link>
                </Button> */}
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
