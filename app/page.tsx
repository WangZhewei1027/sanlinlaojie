import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { LandingPage } from "./components/LandingPage";
import { LandingCta } from "./components/LandingCta";

// 登录状态只影响主 CTA（登录 / 进入工作台），落地页本体保持静态。
// cacheComponents 模式下 cookies() 只能在 Suspense 边界内访问。
async function AuthAwareCta() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return <LandingCta authenticated={!!data?.claims} />;
}

export default function Home() {
  return (
    <LandingPage
      cta={
        <Suspense fallback={null}>
          <AuthAwareCta />
        </Suspense>
      }
    />
  );
}
