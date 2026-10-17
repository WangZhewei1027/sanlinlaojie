import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { QrCode } from "lucide-react";
import { Button } from "../../components/ui/button";
import { CollectionHeaderBar } from "../../app/manage/content/CollectionHeaderBar";

const qr = <Button variant="ghost" size="icon" className="size-8" aria-label="显示二维码"><QrCode className="size-4" aria-hidden /></Button>;

const meta = {
  title: "Manage/Content/Collection Header Bar",
  component: CollectionHeaderBar,
  parameters: { layout: "fullscreen" },
  args: { name: "老街导览", backHref: "/manage/collections", actions: qr },
} satisfies Meta<typeof CollectionHeaderBar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const OpenCollection: Story = {};
export const Archived: Story = { args: { name: "旧展陈", archived: true } };
export const Loading: Story = { args: { name: null, actions: undefined } };
export const LongNameMobile: Story = {
  args: { name: "2026 元宵灯会主会场与东西两街的夜间导览合集" },
  parameters: { viewport: { defaultViewport: "mobile1" } },
};
