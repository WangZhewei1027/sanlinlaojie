import { Button } from "@/components/ui/button";
import { TypographyP } from "@/components/ui/typography";
import {
  PrincipleCompare,
  PrincipleExample,
  PrincipleSection,
} from "../components/PrincipleExample";

const TOKEN_RULES = [
  "只用语义 token（bg-primary、text-muted-foreground、border-border），不写死 hex / bg-black，否则脱离全局 palette 控制。",
  "muted-foreground 是辅助文字的对比度下限（白底约 4.7:1），不要在它基础上再调浅。",
  "同一视图只有一个 primary 主操作按钮，其余用 secondary / outline / ghost。",
];

export function ColorPrincipleStory() {
  return (
    <div className="space-y-10">
      <PrincipleSection title="destructive 只用于不可逆的危险操作">
        <PrincipleCompare>
          <PrincipleExample
            verdict="dont"
            note="普通主操作用了 destructive，红色失去警示含义。"
          >
            <div className="flex gap-2">
              <Button variant="destructive">保存</Button>
              <Button variant="outline">取消</Button>
            </div>
          </PrincipleExample>
          <PrincipleExample
            verdict="do"
            note="删除、清空等不可逆操作才用 destructive，并配二次确认。"
          >
            <div className="flex gap-2">
              <Button>保存</Button>
              <Button variant="destructive">删除资源</Button>
            </div>
          </PrincipleExample>
        </PrincipleCompare>
      </PrincipleSection>
      <PrincipleSection title="Token 使用规则">
        <ul className="list-disc space-y-2 pl-5">
          {TOKEN_RULES.map((rule) => (
            <li key={rule}>
              <TypographyP>{rule}</TypographyP>
            </li>
          ))}
        </ul>
      </PrincipleSection>
    </div>
  );
}
