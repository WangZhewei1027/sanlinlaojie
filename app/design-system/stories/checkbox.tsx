import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { StorySection } from "../components/StorySection";

export function CheckboxStory() {
  return (
    <StorySection title="States">
      <div className="flex items-center gap-2">
        <Checkbox id="ds-cb-1" />
        <Label htmlFor="ds-cb-1">未选中</Label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="ds-cb-2" defaultChecked />
        <Label htmlFor="ds-cb-2">已选中</Label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="ds-cb-3" disabled />
        <Label htmlFor="ds-cb-3">禁用</Label>
      </div>
    </StorySection>
  );
}
