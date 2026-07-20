import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Text } from "@/components/ui/typography";
import {
  PrincipleCompare,
  PrincipleExample,
  PrincipleSection,
} from "../components/PrincipleExample";

const OVERLAY_RULES = [
  "Dialog 内不再打开第二个 Dialog；二次确认在同一弹层内替换内容。",
  "Popover / Dropdown 内不打开新的 Popover；需要更多操作时改用 Dialog 或 Sheet。",
  "同屏最多一层遮罩弹层（Dialog / Drawer / Sheet 互斥）。",
];

export function NestingPrincipleStory() {
  return (
    <div className="space-y-10">
      <PrincipleSection title="Card 内不能再套 Card">
        <PrincipleCompare>
          <PrincipleExample
            verdict="dont"
            note="卡片套卡片产生双重边框，视觉层级混乱，间距失控。"
          >
            <Card>
              <CardHeader className="p-4">
                <CardTitle className="text-base">资源详情</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <Card>
                  <CardHeader className="p-3">
                    <CardTitle className="text-sm">元数据</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0 text-sm text-muted-foreground">
                    拍摄于 2024-05-01
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          </PrincipleExample>
          <PrincipleExample
            verdict="do"
            note="同一张卡片内用分隔线 + 小节标题表达层级。"
          >
            <Card>
              <CardHeader className="p-4">
                <CardTitle className="text-base">资源详情</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 p-4 pt-0">
                <p className="text-sm">一张三林塘港的老照片。</p>
                <div className="border-t pt-3">
                  <p className="text-sm font-medium">元数据</p>
                  <p className="text-sm text-muted-foreground">
                    拍摄于 2024-05-01
                  </p>
                </div>
              </CardContent>
            </Card>
          </PrincipleExample>
        </PrincipleCompare>
      </PrincipleSection>
      <PrincipleSection title="弹层不叠弹层">
        <ul className="list-disc space-y-2 pl-5">
          {OVERLAY_RULES.map((rule) => (
            <li key={rule}>
              <Text as="p" variant="bodyMd">{rule}</Text>
            </li>
          ))}
        </ul>
      </PrincipleSection>
    </div>
  );
}
