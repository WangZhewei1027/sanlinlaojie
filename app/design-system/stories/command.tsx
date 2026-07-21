import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Building2, Check, Pin } from "lucide-react";
import { StorySection } from "../components/StorySection";

export function CommandStory() {
  return (
    <StorySection title="Searchable list (combobox surface)">
      <Command className="w-64 rounded-lg border">
        <CommandInput placeholder="搜索组织" />
        <CommandList className="max-h-64">
          <CommandEmpty>未找到组织</CommandEmpty>
          <CommandGroup heading="已置顶">
            <CommandItem>
              <Building2 className="text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">三林老街</span>
              <Check className="text-primary" />
              <Pin className="text-primary" />
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="组织列表">
            <CommandItem>
              <Building2 className="text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">测试组织</span>
            </CommandItem>
            <CommandItem>
              <Building2 className="text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">
                A rather long organization name that truncates
              </span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </StorySection>
  );
}
