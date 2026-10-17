import { MatchingError } from "@/lib/anchor-matching";
import { getMatchingAnchor } from "@/lib/anchor/access.server";
import {
  modelConfigured,
  syncAnchorEmbedding,
} from "@/lib/anchor/embedding.server";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
type Context = { params: Promise<{ id: string }> };
function failure(error: unknown) {
  return NextResponse.json(
    {
      error:
        error instanceof MatchingError ? error.message : "匹配服务暂不可用",
    },
    { status: error instanceof MatchingError ? error.status : 503 },
  );
}
export async function GET(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const asset = await getMatchingAnchor(id, new URL(request.url).searchParams.get("version_id") ?? "");
    if (!asset.file_url)
      return NextResponse.json({ data: { status: "missing_image" } });
    if (!modelConfigured())
      return NextResponse.json({ data: { status: "unconfigured" } });
    const data = await db
      .selectFrom("anchor_embedding")
      .select(["image_url", "status", "embedding_version", "updated_at"])
      .where("asset_version_id", "=", asset.version_id)
      .executeTakeFirst()
      .catch(() => {
        throw new MatchingError("匹配特征表未就绪，请检查数据库迁移", 503);
      });
    return NextResponse.json(
      {
        data: {
          status:
            data && data.image_url === asset.file_url ? data.status : "pending",
          updated_at: data?.updated_at,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const asset = await getMatchingAnchor(id, new URL(request.url).searchParams.get("version_id") ?? "");
    if (!asset.file_url) throw new MatchingError("请先上传匹配图");
    if (!modelConfigured()) throw new MatchingError("匹配服务尚未配置", 503);
    await syncAnchorEmbedding(id, asset.version_id, asset.file_url);
    return NextResponse.json({ data: { status: "ready" } });
  } catch (error) {
    return failure(error);
  }
}
