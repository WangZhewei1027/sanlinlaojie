"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StorySection } from "../components/StorySection";

export function SonnerStory() {
  return (
    <StorySection title="Toast Types">
      <Button variant="outline" onClick={() => toast("普通消息")}>
        Default
      </Button>
      <Button variant="outline" onClick={() => toast.success("操作成功")}>
        Success
      </Button>
      <Button variant="outline" onClick={() => toast.error("操作失败")}>
        Error
      </Button>
      <Button variant="outline" onClick={() => toast.warning("警告信息")}>
        Warning
      </Button>
      <Button
        variant="outline"
        onClick={() =>
          toast("带操作的消息", {
            action: { label: "撤销", onClick: () => toast("已撤销") },
          })
        }
      >
        With Action
      </Button>
    </StorySection>
  );
}
