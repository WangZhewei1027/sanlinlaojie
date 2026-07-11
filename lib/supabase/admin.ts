import { createClient } from "@supabase/supabase-js";

/**
 * Supabase Admin 客户端（使用 service_role key）
 * 仅在服务端使用，不要暴露给浏览器
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
