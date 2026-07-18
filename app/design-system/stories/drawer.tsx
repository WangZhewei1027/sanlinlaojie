import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { StorySection } from "../components/StorySection";

export function DrawerStory() {
  return (
    <StorySection title="Basic">
      <Drawer>
        <DrawerTrigger asChild>
          <Button variant="outline">打开抽屉</Button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>抽屉标题</DrawerTitle>
            <DrawerDescription>从底部弹出，常用于移动端。</DrawerDescription>
          </DrawerHeader>
          <DrawerFooter>
            <Button>确认</Button>
            <DrawerClose asChild>
              <Button variant="outline">取消</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </StorySection>
  );
}
