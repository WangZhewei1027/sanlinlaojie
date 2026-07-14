interface SectionHeaderProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

export function SectionHeader({ icon: Icon, label }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
      <Icon className="h-3.5 w-3.5" />
      {label}
    </div>
  );
}
