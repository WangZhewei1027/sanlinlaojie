import { Skeleton } from "@/components/ui/skeleton";

/**
 * 成员页加载态骨架屏，镜像“添加成员表单 + 成员列表行”布局。
 * 与 members/page.tsx 的正文结构对齐。
 */
export function MembersSkeleton() {
  return (
    <div className="space-y-6">
      {/* Add member form box */}
      <div className="border rounded-lg p-4 bg-muted/30">
        <Skeleton className="h-4 w-20 mb-3" />
        <div className="flex gap-2 flex-wrap">
          <Skeleton className="h-9 flex-1 min-w-[200px]" />
          <Skeleton className="h-9 w-[120px]" />
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>

      {/* Member rows */}
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between p-4 border rounded-lg"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
              <div className="flex-1 min-w-0 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="h-8 w-[110px] flex-shrink-0" />
            </div>
            <div className="flex items-center gap-1 flex-shrink-0 ml-2">
              <Skeleton className="h-8 w-8" />
              <Skeleton className="h-8 w-8" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
