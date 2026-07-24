import { Skeleton } from "@/components/ui/skeleton";

/**
 * 设置页加载态骨架屏，镜像 OrgSettingsForm 的表单字段布局。
 * 用于替换设置卡片内部的加载态。
 */
export function SettingsFormSkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
      <Skeleton className="h-9 w-24" />
    </div>
  );
}
