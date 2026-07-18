import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { StorySection } from "../components/StorySection";

const SIDES = ["left", "right", "top", "bottom"] as const;

export function SheetStory() {
  return (
    <StorySection title="Sides">
      {SIDES.map((side) => (
        <Sheet key={side}>
          <SheetTrigger asChild>
            <Button variant="outline">{side}</Button>
          </SheetTrigger>
          <SheetContent side={side}>
            <SheetHeader>
              <SheetTitle>侧边面板</SheetTitle>
              <SheetDescription>从 {side} 方向滑出。</SheetDescription>
            </SheetHeader>
          </SheetContent>
        </Sheet>
      ))}
    </StorySection>
  );
}
