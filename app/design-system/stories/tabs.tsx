import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StorySection } from "../components/StorySection";

export function TabsStory() {
  return (
    <StorySection title="Basic">
      <Tabs defaultValue="account" className="w-full max-w-md">
        <TabsList>
          <TabsTrigger value="account">账户</TabsTrigger>
          <TabsTrigger value="password">密码</TabsTrigger>
          <TabsTrigger value="notifications">通知</TabsTrigger>
        </TabsList>
        <TabsContent value="account" className="text-sm text-muted-foreground">
          账户设置内容。
        </TabsContent>
        <TabsContent value="password" className="text-sm text-muted-foreground">
          密码修改内容。
        </TabsContent>
        <TabsContent
          value="notifications"
          className="text-sm text-muted-foreground"
        >
          通知偏好内容。
        </TabsContent>
      </Tabs>
    </StorySection>
  );
}
