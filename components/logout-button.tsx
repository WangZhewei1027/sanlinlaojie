"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useManageStore } from "@/app/manage/store";

export function LogoutButton() {
  const router = useRouter();
  const reset = useManageStore((state) => state.reset);

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    // Clear client-side store state
    reset();
    // Force full refresh so server components reload without auth state
    router.refresh();
    router.push("/auth/login");
  };

  return <Button onClick={logout}>Logout</Button>;
}
