export interface UserData {
  user_id: string;
  name: string | null;
  email: string | null;
  role: string;
  created_at: string;
  last_sign_in_at?: string | null;
}
