export interface UserWorkspaceAssignment {
  id: string;
  workspace_id: string;
  role?: string;
  created_at?: string;
  workspace: {
    id: string;
    name: string;
  } | null;
}

export interface UserData {
  user_id: string;
  name: string | null;
  email: string | null;
  role: string;
  created_at: string;
  last_sign_in_at?: string | null;
  workspace_assignment?: UserWorkspaceAssignment[];
}
