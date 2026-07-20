import { Text } from "@/components/ui/typography";

export function StorySection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <Text as="h3" variant="headingMd">{title}</Text>
      <div className="flex flex-wrap items-center gap-4 rounded-lg border p-6">
        {children}
      </div>
    </section>
  );
}
