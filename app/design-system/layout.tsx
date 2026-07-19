import { StoryNav } from "./components/StoryNav";

export default function DesignSystemLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-[calc(100dvh-3.5rem)]">
      <StoryNav />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl space-y-8 p-8">{children}</div>
      </main>
    </div>
  );
}
