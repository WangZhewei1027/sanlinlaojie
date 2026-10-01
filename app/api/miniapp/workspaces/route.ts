import { db } from "@/lib/db";
import { errorResponse, json, parseIds } from "@/lib/miniapp/request";

// Public: workspace names for the mini-program's title and scan history.
//   GET /api/miniapp/workspaces?ids=<uuid>,<uuid>
//   → [{ id, name }]
export async function GET(request: Request) {
  try {
    const ids = parseIds(request);
    const rows = await db
      .selectFrom("workspace")
      .select(["id", "name"])
      .where("id", "in", ids)
      .execute();
    return json(rows);
  } catch (error) {
    return errorResponse(error);
  }
}
