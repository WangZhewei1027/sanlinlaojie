import { Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TypographyP } from "@/components/ui/typography";
import {
  PrincipleCompare,
  PrincipleExample,
  PrincipleSection,
} from "../components/PrincipleExample";

const LOADING_RULES = [
  "表单、Card、列表的加载态一律用 Skeleton 占位，形状和尺寸对应最终内容，数据到达时零布局跳动。",
  "禁止在内容区域放居中 spinner 或“加载中…”文字 —— 占位高度和真实内容无关，加载完成整块内容突跳。",
  "Skeleton 的行数 / 块数按真实内容的典型数量摆（列表预估 3~5 行），不要只放一条。",
  "图片位用固定宽高比的 Skeleton 容器，避免图片就位时把下方内容挤下去。",
  "spinner 只允许出现在按钮内部的提交中状态（按钮尺寸不变，不引起跳动）。",
];

export function LoadingPrincipleStory() {
  return (
    <div className="space-y-10">
      <PrincipleSection title="Card / 表单加载态：Skeleton，不是 spinner">
        <PrincipleCompare>
          <PrincipleExample
            verdict="dont"
            note="spinner 撑出的高度和真实内容无关，数据到达时整卡高度突变，下方内容跟着跳。"
          >
            <Card>
              <CardHeader className="p-4">
                <CardTitle className="text-base">资源详情</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-center gap-2 p-4 pt-0">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">加载中…</p>
              </CardContent>
            </Card>
          </PrincipleExample>
          <PrincipleExample
            verdict="do"
            note="Skeleton 按最终布局占位（标题、两行正文、缩略图），加载完成原地替换，不跳动。"
          >
            <Card>
              <CardHeader className="p-4">
                <CardTitle className="text-base">资源详情</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 p-4 pt-0">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/5" />
                </div>
                <Skeleton className="aspect-video w-full rounded-md" />
              </CardContent>
            </Card>
          </PrincipleExample>
        </PrincipleCompare>
      </PrincipleSection>
      <PrincipleSection title="加载态规则">
        <ul className="list-disc space-y-2 pl-5">
          {LOADING_RULES.map((rule) => (
            <li key={rule}>
              <TypographyP>{rule}</TypographyP>
            </li>
          ))}
        </ul>
      </PrincipleSection>
    </div>
  );
}
