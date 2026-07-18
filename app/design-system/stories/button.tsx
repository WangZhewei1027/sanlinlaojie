import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StorySection } from "../components/StorySection";

export function ButtonStory() {
  return (
    <div className="space-y-8">
      <StorySection title="Variants">
        <Button>Default</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="destructive">Destructive</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="link">Link</Button>
      </StorySection>
      <StorySection title="Sizes">
        <Button size="lg">Large</Button>
        <Button size="default">Default</Button>
        <Button size="sm">Small</Button>
        <Button size="icon">
          <Plus />
        </Button>
      </StorySection>
      <StorySection title="States">
        <Button disabled>Disabled</Button>
        <Button variant="outline" disabled>
          Disabled Outline
        </Button>
        <Button>
          <Plus />
          With Icon
        </Button>
      </StorySection>
    </div>
  );
}
