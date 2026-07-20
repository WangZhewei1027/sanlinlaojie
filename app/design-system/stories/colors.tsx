import { Text } from "@/components/ui/typography";
import { StorySection } from "../components/StorySection";

function Swatch({
  className,
  name,
  variable,
}: {
  className: string;
  name: string;
  variable: string;
}) {
  return (
    <div className="w-36">
      <div className={`h-16 rounded-md border ${className}`} />
      <Text as="small" variant="bodySm" tone="subdued" className="mt-1.5 block font-medium text-foreground">
        {name}
      </Text>
      <Text as="small" variant="bodySm" tone="subdued" className="block">{variable}</Text>
    </div>
  );
}

export function ColorsStory() {
  return (
    <div className="space-y-8">
      <StorySection title="Base">
        <Swatch className="bg-background" name="background" variable="--background" />
        <Swatch className="bg-foreground" name="foreground" variable="--foreground" />
        <Swatch className="bg-card" name="card" variable="--card" />
        <Swatch className="bg-popover" name="popover" variable="--popover" />
      </StorySection>
      <StorySection title="Semantic">
        <Swatch className="bg-primary" name="primary" variable="--primary" />
        <Swatch className="bg-secondary" name="secondary" variable="--secondary" />
        <Swatch className="bg-muted" name="muted" variable="--muted" />
        <Swatch className="bg-accent" name="accent" variable="--accent" />
        <Swatch className="bg-destructive" name="destructive" variable="--destructive" />
      </StorySection>
      <StorySection title="Lines & Focus">
        <Swatch className="bg-border" name="border" variable="--border" />
        <Swatch className="bg-input" name="input" variable="--input" />
        <Swatch className="bg-ring" name="ring" variable="--ring" />
      </StorySection>
      <StorySection title="Charts">
        <Swatch className="bg-chart-1" name="chart-1" variable="--chart-1" />
        <Swatch className="bg-chart-2" name="chart-2" variable="--chart-2" />
        <Swatch className="bg-chart-3" name="chart-3" variable="--chart-3" />
        <Swatch className="bg-chart-4" name="chart-4" variable="--chart-4" />
        <Swatch className="bg-chart-5" name="chart-5" variable="--chart-5" />
      </StorySection>
      <StorySection title="Radius (--radius)">
        <div className="h-16 w-28 rounded-sm border bg-muted p-2 text-sm">rounded-sm</div>
        <div className="h-16 w-28 rounded-md border bg-muted p-2 text-sm">rounded-md</div>
        <div className="h-16 w-28 rounded-lg border bg-muted p-2 text-sm">rounded-lg</div>
      </StorySection>
    </div>
  );
}
