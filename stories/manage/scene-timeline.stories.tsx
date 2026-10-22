import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { SceneTimeline } from '../../app/manage/scenes/components/SceneTimeline';
import '../../app/manage/scenes/components/scene-editor.css';
const noop = () => {};
const meta = { title: 'Manage/Scene Editor/Transform Timeline', component: SceneTimeline, parameters: { layout: 'fullscreen' },
  decorators: [(Story) => <div className="scene-workspace-theme bg-background text-foreground"><Story /></div>],
  args: { name: '街巷灯笼', time: 1, duration: 10, loop: false, playing: false, readOnly: false, onSeek: noop, onPlay: noop, onDuration: noop, onLoop: noop, onEdit: noop,
    instance: { id: 'lantern', asset: 'lantern', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], animation: null, tracks: { 'rotation.y': [{ time: 0, value: 0, handles: [0, 0, 1, 1], connectedRight: true }, { time: 1, value: Math.PI, handles: [0, 0, 1, 1], connectedRight: true }] } } }
} satisfies Meta<typeof SceneTimeline>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Selected: Story = {};
export const Empty: Story = { args: { instance: undefined, name: undefined } };
export const EmptyNarrow: Story = { ...Empty, decorators: [(Story) => <div className="w-full max-w-sm"><Story /></div>] };
export const ReadOnly: Story = { args: { readOnly: true } };
export const Playing: Story = { args: { playing: true } };
