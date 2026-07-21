import { AccordionStory } from "./accordion";
import { BadgeStory } from "./badge";
import { BreadcrumbStory } from "./breadcrumb";
import { ButtonStory } from "./button";
import { CardStory } from "./card";
import { CheckboxStory } from "./checkbox";
import { ColorsStory } from "./colors";
import { ColorPrincipleStory } from "./principle-color";
import { DialogStory } from "./dialog";
import { DrawerStory } from "./drawer";
import { DropdownMenuStory } from "./dropdown-menu";
import { InputStory } from "./input";
import { LabelStory } from "./label";
import { LoadingPrincipleStory } from "./principle-loading";
import { NestingPrincipleStory } from "./principle-nesting";
import { TouchPrincipleStory } from "./principle-touch";
import { PopoverStory } from "./popover";
import { SelectStory } from "./select";
import { SheetStory } from "./sheet";
import { SkeletonStory } from "./skeleton";
import { SonnerStory } from "./sonner";
import { TabsStory } from "./tabs";
import { TextStory } from "./text";
import { TextareaStory } from "./textarea";

export interface Story {
  id: string;
  name: string;
  component: React.ComponentType;
  /** 源文件位置；缺省为 components/ui/<id>.tsx */
  path?: string;
}

export interface StoryGroup {
  title: string;
  items: Story[];
}

export const storyGroups: StoryGroup[] = [
  {
    title: "设计令牌",
    items: [
      {
        id: "colors",
        name: "Colors",
        component: ColorsStory,
        path: "app/globals.css + tailwind.config.ts",
      },
      {
        id: "text",
        name: "Text",
        component: TextStory,
        path: "components/ui/typography.tsx",
      },
    ],
  },
  {
    title: "组件",
    items: [
      { id: "accordion", name: "Accordion", component: AccordionStory },
      { id: "badge", name: "Badge", component: BadgeStory },
      { id: "breadcrumb", name: "Breadcrumb", component: BreadcrumbStory },
      { id: "button", name: "Button", component: ButtonStory },
      { id: "card", name: "Card", component: CardStory },
      { id: "checkbox", name: "Checkbox", component: CheckboxStory },
      { id: "dialog", name: "Dialog", component: DialogStory },
      { id: "drawer", name: "Drawer", component: DrawerStory },
      {
        id: "dropdown-menu",
        name: "Dropdown Menu",
        component: DropdownMenuStory,
      },
      { id: "input", name: "Input", component: InputStory },
      { id: "label", name: "Label", component: LabelStory },
      { id: "popover", name: "Popover", component: PopoverStory },
      { id: "select", name: "Select", component: SelectStory },
      { id: "sheet", name: "Sheet", component: SheetStory },
      { id: "skeleton", name: "Skeleton", component: SkeletonStory },
      { id: "sonner", name: "Sonner (Toast)", component: SonnerStory },
      { id: "tabs", name: "Tabs", component: TabsStory },
      { id: "textarea", name: "Textarea", component: TextareaStory },
    ],
  },
  {
    title: "设计原则",
    items: [
      {
        id: "principle-nesting",
        name: "布局嵌套",
        component: NestingPrincipleStory,
        path: "设计约定 · Design Guidelines",
      },
      {
        id: "principle-color",
        name: "颜色语义",
        component: ColorPrincipleStory,
        path: "设计约定 · Design Guidelines",
      },
      {
        id: "principle-touch",
        name: "移动端适配",
        component: TouchPrincipleStory,
        path: "设计约定 · Design Guidelines",
      },
      {
        id: "principle-loading",
        name: "加载态",
        component: LoadingPrincipleStory,
        path: "设计约定 · Design Guidelines",
      },
    ],
  },
];

export const stories: Story[] = storyGroups.flatMap((group) => group.items);
