import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StorySection } from "../components/StorySection";

export function TextareaStory() {
  return (
    <StorySection title="Basic">
      <div className="grid w-80 gap-1.5">
        <Label htmlFor="ds-textarea">备注</Label>
        <Textarea id="ds-textarea" placeholder="请输入备注信息" />
      </div>
      <Textarea className="w-80" disabled placeholder="Disabled" />
    </StorySection>
  );
}
