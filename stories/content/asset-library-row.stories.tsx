import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AssetLibraryRow } from "../../app/manage/content/AssetLibraryRow";
import { libraryItems, noop, organizationItems } from "./fixtures";

const meta = {
  title: "Manage/Content/Asset Library Row",
  component: AssetLibraryRow,
  parameters: { layout: "padded" },
  decorators: [(Story) => <ul className="rounded-lg border"><Story /></ul>],
  args: { asset: libraryItems[0], scope: "project", href: "#", onAddToProject: noop },
} satisfies Meta<typeof AssetLibraryRow>;
export default meta;
type Story = StoryObj<typeof meta>;

export const ProjectAsset: Story = {};
export const RestrictedWithoutMaintainer: Story = { args: { asset: { ...libraryItems[1], maintainer: null } } };
export const SharedNotInProject: Story = { args: { scope: "organization", asset: organizationItems[1] } };
export const SharedAlreadyInProject: Story = { args: { scope: "organization", asset: organizationItems[0] } };
export const Adding: Story = { args: { scope: "organization", asset: organizationItems[1], adding: true } };
export const Archived: Story = { args: { asset: libraryItems[3] } };
export const FileMissingLongName: Story = { args: { asset: libraryItems[4] } };
export const TextAsset: Story = { args: { asset: libraryItems[2] } };
