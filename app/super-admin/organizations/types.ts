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
  text_asset_miniapp_style?: string;
  config?: OrgConfig | null;
}
