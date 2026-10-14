import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SceneAnimationClip } from "../../app/manage/scenes/components/SceneAnimationClip";
import "../../app/manage/scenes/components/scene-editor.css";
const meta = {
  title:"Manage/Scene Editor/Animation Clip", component: SceneAnimationClip,
  decorators:[(Story) => <div className="relative m-8 h-8 w-[600px] border"><Story /></div>],
  args:{animation:{clipIndex:0,startSeconds:2,loop:false},clip:{name:"Walk",duration:3},duration:10,onSelect:()=>{},onSeek:()=>{},onMove:()=>{}},
} satisfies Meta<typeof SceneAnimationClip>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Movable: Story = {};
export const Looping: Story = {args:{animation:{clipIndex:0,startSeconds:2,loop:true}}};
