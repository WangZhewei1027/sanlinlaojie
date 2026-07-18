import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StorySection } from "../components/StorySection";

export function CardStory() {
  return (
    <StorySection title="Basic">
      <Card className="w-80">
        <CardHeader>
          <CardTitle>卡片标题</CardTitle>
          <CardDescription>卡片的描述文字，用于补充说明。</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm">卡片正文内容区域。</p>
        </CardContent>
        <CardFooter className="gap-2">
          <Button size="sm">确认</Button>
          <Button size="sm" variant="outline">
            取消
          </Button>
        </CardFooter>
      </Card>
    </StorySection>
  );
}
