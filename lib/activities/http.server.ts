import "server-only";
import { ContentError } from "@/lib/content-model/errors";
import { errorResponse, json } from "@/lib/miniapp/request";
export function activityFailure(error: unknown) {
  return error instanceof ContentError ? json({ error: error.message, code: error.code }, error.status) : errorResponse(error);
}
