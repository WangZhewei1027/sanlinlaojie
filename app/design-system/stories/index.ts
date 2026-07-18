import { AccordionStory } from "./accordion";
import { BadgeStory } from "./badge";
import { ButtonStory } from "./button";
import { CardStory } from "./card";
import { CheckboxStory } from "./checkbox";
import { DialogStory } from "./dialog";
import { DrawerStory } from "./drawer";
import { DropdownMenuStory } from "./dropdown-menu";
import { InputStory } from "./input";
import { LabelStory } from "./label";
import { PopoverStory } from "./popover";
import { SelectStory } from "./select";
import { SheetStory } from "./sheet";
import { SkeletonStory } from "./skeleton";
import { SonnerStory } from "./sonner";
import { TabsStory } from "./tabs";
import { TextareaStory } from "./textarea";

export interface Story {
  id: string;
  name: string;
  component: React.ComponentType;
}

export const stories: Story[] = [
  { id: "accordion", name: "Accordion", component: AccordionStory },
  { id: "badge", name: "Badge", component: BadgeStory },
  { id: "button", name: "Button", component: ButtonStory },
  { id: "card", name: "Card", component: CardStory },
  { id: "checkbox", name: "Checkbox", component: CheckboxStory },
  { id: "dialog", name: "Dialog", component: DialogStory },
  { id: "drawer", name: "Drawer", component: DrawerStory },
  { id: "dropdown-menu", name: "Dropdown Menu", component: DropdownMenuStory },
  { id: "input", name: "Input", component: InputStory },
  { id: "label", name: "Label", component: LabelStory },
  { id: "popover", name: "Popover", component: PopoverStory },
  { id: "select", name: "Select", component: SelectStory },
  { id: "sheet", name: "Sheet", component: SheetStory },
  { id: "skeleton", name: "Skeleton", component: SkeletonStory },
  { id: "sonner", name: "Sonner (Toast)", component: SonnerStory },
  { id: "tabs", name: "Tabs", component: TabsStory },
  { id: "textarea", name: "Textarea", component: TextareaStory },
];
