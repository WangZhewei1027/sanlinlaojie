import type { TextAssetMiniappStyle } from "@/app/manage/types";

export interface MemberData {
  id: string;
  role: string;
  user_id: string;
  users: {
    user_id: string;
    name: string | null;
    email: string | null;
  };
}

export interface OrgConfig {
  confetti_enabled?: boolean;
  shop_checkin_enabled?: boolean;
  footer_enabled?: boolean;
  text_asset_miniapp_style?: TextAssetMiniappStyle;
}

export interface OrgData {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  created_by: string;
  organization_member: MemberData[];
  map_center: { lat: number; lng: number } | null;
  allowed_file_types: string[] | null;
  config?: OrgConfig | null;
}
