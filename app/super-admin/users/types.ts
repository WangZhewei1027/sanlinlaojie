export interface UserWorkspaceAssignment {
  id: string;
  workspace_id: string;
  workspace: {
    id: string;
    name: string;
  };
}

export interface UserData {
  user_id: string;
  name: string | null;
  email: string | null;
  role: string;
  created_at: string;
  workspace_assignment?: UserWorkspaceAssignment[];
}
