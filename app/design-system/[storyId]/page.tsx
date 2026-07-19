import { notFound } from "next/navigation";
import {
  TypographyH1,
  TypographySmall,
} from "@/components/ui/typography";
import { stories } from "../stories";

export function generateStaticParams() {
  return stories.map((story) => ({ storyId: story.id }));
}

export default async function StoryPage({
  params,
}: {
  params: Promise<{ storyId: string }>;
}) {
  const { storyId } = await params;
  const story = stories.find((s) => s.id === storyId);
  if (!story) notFound();

  const ActiveStory = story.component;

  return (
    <>
      <div className="space-y-1">
        <TypographyH1>{story.name}</TypographyH1>
        <TypographySmall className="block">
          {story.path ?? `components/ui/${story.id}.tsx`}
        </TypographySmall>
      </div>
      <ActiveStory />
    </>
  );
}
