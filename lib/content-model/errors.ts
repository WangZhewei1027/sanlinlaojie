import { CONTENT_ERROR_STATUS, type ApiErrorDetails, type ContentErrorCode } from "./contracts";

/** Typed domain failure; route handlers turn it into `{ error, code, details }`. */
export class ContentError extends Error {
  readonly status: number;

  constructor(
    readonly code: ContentErrorCode,
    message: string,
    readonly details?: ApiErrorDetails,
    status?: number,
  ) {
    super(message);
    this.name = "ContentError";
    this.status = status ?? CONTENT_ERROR_STATUS[code];
  }
}

export const invalid = (message: string, issues?: { path: string; message: string }[]) =>
  new ContentError("VALIDATION_FAILED", message, issues ? { issues } : undefined);
export const forbidden = (message = "权限不足") => new ContentError("FORBIDDEN", message);
export const notFound = (message = "资源不存在") => new ContentError("NOT_FOUND", message);
export const archived = (message: string) => new ContentError("ARCHIVED", message);
/** 410 for retired project-ACL mutations (grants, project members, assignments). */
export const deprecated = (message: string) => new ContentError("DEPRECATED", message);

/** 428 when the client omitted the guard, 409 when it is stale. */
export function checkLockVersion(expected: number | undefined, current: number, what = "内容"): void {
  if (expected === undefined) throw new ContentError("LOCK_VERSION_REQUIRED", `保存${what}需要提供 expectedLockVersion`);
  if (expected !== current)
    throw new ContentError("LOCK_VERSION_CONFLICT", `${what}已被其他人更新，请保留本地内容并重新载入`, { current_lock_version: current });
}
