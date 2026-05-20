import Link from "next/link";

export default function InstructionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground transition-colors">
          ← Home
        </Link>
        <div className="flex gap-4">
          <Link
            href="/instructions/en"
            className="hover:text-foreground transition-colors"
          >
            English
          </Link>
          <Link
            href="/instructions/zh"
            className="hover:text-foreground transition-colors"
          >
            中文
          </Link>
        </div>
      </div>
      <article className="prose prose-neutral dark:prose-invert max-w-none">
        {children}
      </article>
    </div>
  );
}
