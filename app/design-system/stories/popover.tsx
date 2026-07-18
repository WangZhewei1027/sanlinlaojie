import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { StorySection } from "../components/StorySection";

export function PopoverStory() {
  return (
    <StorySection title="Basic">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline">打开 Popover</Button>
        </PopoverTrigger>
        <PopoverContent className="w-72">
          <PopoverHeader>
            <PopoverTitle>浮层标题</PopoverTitle>
            <PopoverDescription>
              点击外部区域即可关闭浮层。
            </PopoverDescription>
          </PopoverHeader>
        </PopoverContent>
      </Popover>
    </StorySection>
  );
}
