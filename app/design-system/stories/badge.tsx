import { Badge } from "@/components/ui/badge";
import { StorySection } from "../components/StorySection";

export function BadgeStory() {
  return (
    <StorySection title="Variants">
      <Badge>Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="destructive">Destructive</Badge>
      <Badge variant="outline">Outline</Badge>
    </StorySection>
  );
}
