import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { StorySection } from "../components/StorySection";

export function LabelStory() {
  return (
    <StorySection title="Basic">
      <Label>普通标签</Label>
      <div className="flex items-center gap-2">
        <Checkbox id="ds-label-terms" />
        <Label htmlFor="ds-label-terms">与表单控件关联</Label>
      </div>
    </StorySection>
  );
}
