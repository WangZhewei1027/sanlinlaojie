import { Skeleton } from "@/components/ui/skeleton";
import { StorySection } from "../components/StorySection";

export function SkeletonStory() {
  return (
    <StorySection title="Basic">
      <div className="flex items-center gap-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <Skeleton className="h-32 w-64 rounded-lg" />
    </StorySection>
  );
}
