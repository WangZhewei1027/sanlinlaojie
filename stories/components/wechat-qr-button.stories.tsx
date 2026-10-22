import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { createPortal } from "react-dom";
import { useState } from "react";
import { WeChatQrButton, type WeChatQrButtonProps } from "@/components/wechat-qr-button";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/typography";
import "@/app/manage/scenes/components/scene-workspace-theme.css";
const meta = { title: "Components/WeChat QR Button", component: WeChatQrButton,
  args: { label: "微信扫码预览", title: "微信扫码预览场景", description: "展示最近保存的场景。AR 加载后，点击放置按钮显示在前方。", load: async (): Promise<{ url?: string; error?: string }> => ({ error: "二维码暂时不可用，请重试" }) },
  parameters: { layout: "centered" },
} satisfies Meta<typeof WeChatQrButton>;
export default meta;
type Story = StoryObj<typeof meta>;
export const ErrorRetry: Story = {};
export const Loading: Story = { args: { load: () => new Promise(() => {}) } };
export const Unsaved: Story = { args: { description: "当前有未保存的修改，扫码展示上次保存的内容。" } };
const imageFixture = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="224" height="224" viewBox="0 0 224 224"><rect width="224" height="224" fill="white"/><text x="112" y="112" text-anchor="middle" fill="black">Image fixture</text></svg>')}`;
export const ImageLoaded: Story = { args: { description: "仅验证图片加载与尺寸，此示意图不可扫码。", load: async () => ({ url: imageFixture }) } };

/** Portal both the trigger and content to a separate document, without nesting Storybook runtimes. */
function CrossDocumentExample(props: WeChatQrButtonProps) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  return <div className="scene-workspace-theme flex min-h-96"><aside className="w-48 shrink-0 border-r p-4"><Text as="p" variant="bodySm">外层文档</Text><Button variant="secondary" className="mt-4">外层焦点</Button></aside><iframe title="浮层目标文档" className="h-96 min-w-0 flex-1 border-0" srcDoc={'<!doctype html><html><head></head><body class="scene-workspace-theme" style="margin:0"></body></html>'} onLoad={(event) => {
    const doc = event.currentTarget.contentDocument;
    if (!doc) return;
    event.currentTarget.ownerDocument.querySelectorAll('style, link[rel="stylesheet"]').forEach((style) => doc.head.append(style.cloneNode(true)));
    setHost(doc.body);
  }} />{host && createPortal(<><header className="flex h-14 items-center justify-end border-b px-3"><WeChatQrButton {...props} portalContainer={host} /></header><Text as="p" variant="bodySm" className="p-4">弹层与按钮在同一文档，继承局部主题。</Text></>, host)}</div>;
}
export const CrossDocument: Story = {
  parameters: { layout: "fullscreen", docs: { description: { story: "跨文档 portal：运行代码的文档与按钮所在文档不同。弹层应在按钮下方，并继承按钮所在文档的 Light 主题。" } } },
  render: (args) => <CrossDocumentExample {...args} />,
};
