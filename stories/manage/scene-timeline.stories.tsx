import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SceneTimeline } from "../../app/manage/scenes/components/SceneTimeline";
import "../../app/manage/scenes/components/scene-editor.css";
const noop = () => {};
const meta = {
  title: "Manage/Scene Editor/Timeline", component: SceneTimeline, parameters: { layout: "fullscreen" },
  decorators: [(Story) => <div style={{ "--scene-left-width": "232px" } as React.CSSProperties}><Story /></div>],
  args: { instances: [], names: {}, clips: {}, selectedId: null, time: 0, duration: 10, minDuration: 0.1, playing: false, loop: false, record: false, preview: false, onSelect: noop, onSeek: noop, onPlay: noop, onLoop: noop, onRecord: noop, onDuration: noop, onMoveKey: noop, onDeleteKey: noop, onMoveClip: noop },
} satisfies Meta<typeof SceneTimeline>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Blank: Story = {};
export const KeyframesAndClip: Story = { args: { time: 2, selectedId: "fox", names: { fox: "狐狸" }, clips: {fox:[{name:"Walk",duration:3}]}, instances: [{ id: "fox", asset: "model", position: [0,0,0], quaternion: [0,0,0,1], scale: [1,1,1], animation: {clipIndex:0,startSeconds:1,loop:true}, tracks: { "position.x": [{time:0,value:0,handles:[0.5,1,0.5,0],connectedRight:true},{time:4,value:2,handles:[0.5,1,0.5,0],connectedRight:true}] } }] } };
export const PreviewPlayback: Story = { args: { preview: true, playing: true, time: 3.5 } };
