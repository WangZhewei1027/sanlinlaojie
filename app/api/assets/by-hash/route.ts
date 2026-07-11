import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * 按内容 hash 查已存在的文件 URL，用于上传前全局去重。
 * 命中则复用返回的 file_url、跳过重复存储上传；未命中返回 { file_url: null }。
 * assets 桶为 public，全局复用同一 URL 是安全的（只暴露已 public 的对象）。
 */
export async function GET(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const hash = searchParams.get("hash");

  if (!hash) {
    return NextResponse.json({ error: "缺少 hash" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("asset")
    .select("file_url")
    .eq("content_hash", hash)
    .not("file_url", "is", null)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("by-hash 查询失败:", error);
    return NextResponse.json({ error: "查询失败" }, { status: 500 });
  }

  return NextResponse.json({ file_url: data?.file_url ?? null });
}
