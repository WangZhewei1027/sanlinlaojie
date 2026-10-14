import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SceneModelDropZone } from "../../app/manage/scenes/components/SceneModelDropZone";
import "../../app/manage/scenes/components/scene-editor.css";
const meta = {
  title:"Manage/Scene Editor/Model Drop Zone", component:SceneModelDropZone,
  decorators:[(Story)=><div className="flex h-72"><Story /></div>],
  args:{models:[],enabled:true,placementRef:{current:()=>[0,0,0]},onAdd:()=>{},children:<div className="h-full bg-muted p-4">场景地面放置区域</div>},
} satisfies Meta<typeof SceneModelDropZone>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Ready: Story = {};
export const AtInstanceLimit: Story = {args:{enabled:false}};
