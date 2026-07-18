import { cn } from "@/lib/utils";
import { TypographyH3, TypographySmall } from "@/components/ui/typography";

// 原则页的分节：无外层边框，仅标题 + 内容
export function PrincipleSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <TypographyH3>{title}</TypographyH3>
      {children}
    </section>
  );
}

// 避免 / 推荐 两栏对比
export function PrincipleCompare({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-6 sm:grid-cols-2">{children}</div>;
}

export function PrincipleExample({
  verdict,
  note,
  children,
}: {
  verdict: "do" | "dont";
  note: string;
  children: React.ReactNode;
}) {
  const isDo = verdict === "do";
  return (
    <div className="flex flex-col gap-2">
      <TypographySmall
        className={cn(
          "font-medium",
          isDo ? "text-foreground" : "text-destructive",
        )}
      >
        {isDo ? "✓ 推荐" : "✕ 避免"}
      </TypographySmall>
      <div className="flex-1 rounded-lg border p-4">{children}</div>
      <TypographySmall>{note}</TypographySmall>
    </div>
  );
}
