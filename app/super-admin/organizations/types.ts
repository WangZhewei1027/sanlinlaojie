import type { OrgConfig } from "@/components/org-settings/types";

export type { OrgConfig };

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
