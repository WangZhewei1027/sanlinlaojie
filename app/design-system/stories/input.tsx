import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StorySection } from "../components/StorySection";

export function InputStory() {
  return (
    <div className="space-y-8">
      <StorySection title="Basic">
        <Input className="w-64" placeholder="请输入内容" />
        <Input className="w-64" type="password" placeholder="密码" />
        <Input className="w-64" disabled placeholder="Disabled" />
      </StorySection>
      <StorySection title="With Label">
        <div className="grid w-64 gap-1.5">
          <Label htmlFor="ds-input-email">邮箱</Label>
          <Input id="ds-input-email" type="email" placeholder="you@example.com" />
        </div>
      </StorySection>
    </div>
  );
}
