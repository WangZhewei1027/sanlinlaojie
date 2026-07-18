import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { StorySection } from "../components/StorySection";

export function DialogStory() {
  return (
    <StorySection title="Basic">
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline">打开对话框</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>对话框标题</DialogTitle>
            <DialogDescription>
              这里是对话框的描述文字，说明这个操作的作用。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">取消</Button>
            </DialogClose>
            <Button>确认</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StorySection>
  );
}
