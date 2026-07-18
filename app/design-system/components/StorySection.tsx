import { TypographyH3 } from "@/components/ui/typography";

export function StorySection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <TypographyH3>{title}</TypographyH3>
      <div className="flex flex-wrap items-center gap-4 rounded-lg border p-6">
        {children}
      </div>
    </section>
  );
}
