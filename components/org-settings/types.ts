import type { TextAssetMiniappStyle } from "@/app/manage/types";

/**
 * config.text_asset_miniapp_style 缺失时小程序端的实际行为：
 * xr-start 组件初始值与拉取回退均为 dialog_decorated（气泡样式），
 * 表单缺省展示必须与之一致，否则保存会把错误的默认写进 config、
 * 静默改变小程序渲染。（docs/text-asset-miniapp-style.md 里的
 * plain_white 默认值是已废弃顶层列的历史 DDL，不是现行为。）
 */
export const DEFAULT_TEXT_ASSET_MINIAPP_STYLE: TextAssetMiniappStyle =
  "dialog_decorated";

/** organization.config 里由管理界面维护的键 */
export interface OrgConfig {
  confetti_enabled?: boolean;
  shop_checkin_enabled?: boolean;
  footer_enabled?: boolean;
  text_asset_miniapp_style?: TextAssetMiniappStyle;
}

/** 组织设置表单需要的最小组织形状（super-admin 的 OrgData 和 /admin 拉取的行都满足） */
export interface OrgSettingsSource {
  name: string;
  description: string | null;
  map_center: { lat: number; lng: number } | null;
  allowed_file_types: string[] | null;
  config?: OrgConfig | null;
}

/** 保存时提交的完整设置载荷 */
export interface OrgSettingsPayload {
  name: string;
  description: string | null;
  map_center: { lat: number; lng: number } | null;
  allowed_file_types: string[] | null;
  config: OrgConfig;
}

/** 由调用方决定落库方式：super-admin 走 server action，/admin 走 PUT API */
export type SaveOrgSettings = (
  payload: OrgSettingsPayload,
) => Promise<{ error?: string }>;
