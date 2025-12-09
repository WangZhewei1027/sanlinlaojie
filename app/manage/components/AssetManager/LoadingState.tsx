import { Card } from "@/components/ui/card";

export function LoadingState() {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-center">
        <p className="text-sm text-muted-foreground">加载中...</p>
      </div>
    </Card>
  );
}
