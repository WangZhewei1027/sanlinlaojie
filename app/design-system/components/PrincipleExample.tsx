import { Text } from "@/components/ui/typography";

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
      <Text as="h3" variant="headingMd">{title}</Text>
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
      <Text
        as="small"
        variant="bodySm"
        fontWeight="medium"
        tone={isDo ? "default" : "critical"}
      >
        {isDo ? "✓ 推荐" : "✕ 避免"}
      </Text>
      <div className="flex-1 rounded-lg border p-4">{children}</div>
      <Text as="small" variant="bodySm" tone="subdued">{note}</Text>
    </div>
  );
}
