import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Text } from "@/components/ui/typography";
import {
  PrincipleCompare,
  PrincipleExample,
  PrincipleSection,
} from "../components/PrincipleExample";

const TOUCH_RULES = [
  "hover 只做视觉增强（高亮、阴影、提示），不承载唯一的信息或功能入口 —— 触屏设备没有 hover。",
  "次要操作收进始终可见的 “⋯” 菜单，或直接常驻显示；不要用 group-hover 隐藏按钮。",
  "Tooltip 里的内容必须另有可发现的途径（触屏上长按不一定能唤出提示）。",
  "触控目标不小于 40×40px（图标按钮用 size=\"icon\"），密集列表里相邻目标间距 ≥ 8px。",
  "移动端的操作面板优先用底部 Drawer（拇指可达），居中 Dialog 只用于简短确认。",
  "全屏高度用 dvh 而不是 vh，避免移动端浏览器地址栏遮挡内容。",
];

export function TouchPrincipleStory() {
  return (
    <div className="space-y-10">
      <PrincipleSection title="功能入口不能只在 hover 时可见">
        <PrincipleCompare>
          <PrincipleExample
            verdict="dont"
            note="操作按钮 hover 才出现（桌面上把鼠标移上去试试）——触屏用户永远看不到它们。"
          >
            <div className="group flex items-center justify-between gap-2 rounded-md border p-3">
              <p className="text-sm">老照片_三林塘港.jpg</p>
              <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <Button size="sm" variant="ghost">
                  编辑
                </Button>
                <Button size="sm" variant="ghost">
                  删除
                </Button>
              </div>
            </div>
          </PrincipleExample>
          <PrincipleExample
            verdict="do"
            note="入口（⋯）始终可见，次要操作收进菜单；hover 只用来高亮整行。"
          >
            <div className="flex items-center justify-between gap-2 rounded-md border p-3 transition-colors hover:bg-accent/50">
              <p className="text-sm">老照片_三林塘港.jpg</p>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost">
                    <MoreHorizontal />
                    <span className="sr-only">更多操作</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>编辑</DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive">
                    删除
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </PrincipleExample>
        </PrincipleCompare>
      </PrincipleSection>
      <PrincipleSection title="触屏适配规则">
        <ul className="list-disc space-y-2 pl-5">
          {TOUCH_RULES.map((rule) => (
            <li key={rule}>
              <Text as="p" variant="bodyMd">{rule}</Text>
            </li>
          ))}
        </ul>
      </PrincipleSection>
    </div>
  );
}
