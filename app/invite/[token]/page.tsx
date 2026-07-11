import { Suspense } from "react";
import { connection } from "next/server";
import { InviteClient } from "./InviteClient";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  // 依赖运行时（登录态），opt out 预渲染（cacheComponents 下不能用 export dynamic）
  await connection();
  const { token } = await params;
  return (
    <Suspense fallback={null}>
      <InviteClient token={token} />
    </Suspense>
  );
}
