import "server-only";
import { db, sql } from "@/lib/db";
import type { AssetVersionDto, ContentModelState } from "@/lib/content-model/contracts";
import type { Actor } from "@/lib/content-model/access.server";
import { contentTransaction, audit, lockKeys, grantLockKey, type Executor } from "@/lib/content-model/tx.server";
import { asFileType, loadVersionDtos, primaryResource } from "@/lib/assets/dto.server";
import { appendVersion } from "@/lib/assets/versions.server";
import { compileSceneManifest } from "@/lib/scene/compile";
import type { SceneAssetManifest } from "@/lib/scene/protocol";
import { resolvePlacementContent } from "./content.server";
import { parseLinkAssetInput, type LinkAssetData } from "@/lib/link-asset";
import { renderConfigOf, pointSql } from "./core.server";

/**
 * Public runtime for cut-over organizations (plan §7.1). Every read goes
 * through active placements and their fixed versions/revisions; the asset
 * catalog, grants and drafts never decide what is shown. Output keeps the
 * legacy DTO shapes and ids (legacy public id when bound, else placement id).
 */

export interface RuntimeScope {
  workspaceId: string | null;
  organizationId: string | null;
}

/** Content-model state of the organization a scope resolves to (null = unknown scope). */
export async function scopeState(scope: RuntimeScope): Promise<{ organizationId: string; state: ContentModelState } | null> {
  if (scope.workspaceId) {
    const row = await db
      .selectFrom("workspace as w")
      .innerJoin("organization as o", "o.id", "w.organization_id")
      .select(["o.id", "o.content_model_state"])
      .where("w.id", "=", scope.workspaceId)
      .executeTakeFirst();
    if (!row || (scope.organizationId && row.id !== scope.organizationId)) return null;
    return { organizationId: row.id, state: row.content_model_state as ContentModelState };
  }
  if (scope.organizationId) {
    const row = await db.selectFrom("organization").select(["id", "content_model_state"]).where("id", "=", scope.organizationId).executeTakeFirst();
    return row ? { organizationId: row.id, state: row.content_model_state as ContentModelState } : null;
  }
  return null;
}

interface RuntimeRow {
  id: string;
  workspace_id: string;
  organization_id: string;
  name: string | null;
  asset_id: string | null;
  asset_version_id: string | null;
  scene_revision_id: string | null;
  anchor_id: string | null;
  render_config: unknown;
  altitude: number | null;
  created_at: Date;
  longitude: number | null;
  latitude: number | null;
  public_id: string;
  binding_id: string | null;
}

/**
 * Active placements visible in a public scope: open v2 organization, open
 * owning project, and — when a project is requested — owned by it or exposed
 * to it through an active legacy scope of an open project. An archived owner
 * project hides its canonical placements everywhere (plan §5.2).
 */
function runtimeQuery(exec: Executor, scope: RuntimeScope) {
  let query = exec
    .selectFrom("placement as p")
    .innerJoin("workspace as w", "w.id", "p.workspace_id")
    .innerJoin("organization as o", "o.id", "p.organization_id")
    .leftJoin("legacy_runtime_binding as b", "b.placement_id", "p.id")
    .select([
      "p.id",
      "p.workspace_id",
      "p.organization_id",
      "p.name",
      "p.asset_id",
      "p.asset_version_id",
      "p.scene_revision_id",
      "p.anchor_id",
      "p.render_config",
      "p.altitude",
      "p.created_at",
      sql<number | null>`ST_X(p.location)`.as("longitude"),
      sql<number | null>`ST_Y(p.location)`.as("latitude"),
      sql<string>`coalesce(b.public_id, p.id)`.as("public_id"),
      "b.id as binding_id",
    ])
    .where("p.status", "=", "active")
    .where("o.content_model_state", "=", "v2")
    .where("o.archived_at", "is", null)
    .where("w.archived_at", "is", null);
  if (scope.organizationId) query = query.where("p.organization_id", "=", scope.organizationId);
  if (scope.workspaceId) {
    const workspaceId = scope.workspaceId;
    query = query
      .where((eb) =>
        eb.exists(eb.selectFrom("workspace as sw").select("sw.id").where("sw.id", "=", workspaceId).where("sw.archived_at", "is", null)),
      )
      .where((eb) =>
        eb.or([
          eb("p.workspace_id", "=", workspaceId),
          eb.exists(
            eb
              .selectFrom("legacy_content_map as m")
              .select("m.binding_id")
              .whereRef("m.binding_id", "=", "b.id")
              .where("m.workspace_id", "=", workspaceId)
              .where("m.active", "=", true),
          ),
        ]),
      );
  }
  return query;
}

interface ProjectionContext {
  versions: Map<string, AssetVersionDto>;
  fileTypes: Map<string, string>;
}

async function projectionContext(exec: Executor, rows: RuntimeRow[]): Promise<ProjectionContext> {
  const versionIds = rows.map((r) => r.asset_version_id).filter((id): id is string => !!id);
  const assetIds = rows.map((r) => r.asset_id).filter((id): id is string => !!id);
  const [versions, assets] = await Promise.all([
    loadVersionDtos(exec, versionIds),
    assetIds.length ? exec.selectFrom("asset").select(["id", "file_type"]).where("id", "in", [...new Set(assetIds)]).execute() : Promise.resolve([]),
  ]);
  return { versions, fileTypes: new Map(assets.map((a) => [a.id, a.file_type])) };
}

function scalarRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function linkData(url: string): LinkAssetData | null {
  try {
    return parseLinkAssetInput(url);
  } catch {
    return null;
  }
}

/**
 * Legacy asset-row shape of one placement (file_url, text_content, metadata,
 * config, is_huge). Migrated versions restore their frozen legacy
 * metadata/config (payload.migration_legacy); position always comes from the
 * placement and files always from the pinned version's resources.
 */
function legacyContent(row: RuntimeRow, ctx: ProjectionContext) {
  const render = renderConfigOf(row.render_config);
  const location = row.longitude !== null && row.latitude !== null ? { longitude: row.longitude, latitude: row.latitude, height: row.altitude ?? undefined } : {};
  if (!row.asset_version_id) {
    return {
      file_type: "scene",
      file_url: null as string | null,
      text_content: null as string | null,
      metadata: { ...scalarRecord(render.display), ...location } as Record<string, unknown>,
      config: { ...scalarRecord(render.config) } as Record<string, unknown>,
      is_huge: false,
      name: row.name,
    };
  }
  const version = ctx.versions.get(row.asset_version_id);
  const fileType = asFileType(ctx.fileTypes.get(row.asset_id ?? "") ?? version?.payload.kind ?? "document");
  const payload = version?.payload;
  const legacy = payload?.migration_legacy;
  const metadata: Record<string, unknown> = {
    ...scalarRecord(legacy?.metadata),
    ...scalarRecord(payload?.attributes),
    ...scalarRecord(render.display),
    ...location,
  };
  const checkin = version?.resources.find((r) => r.role === "checkin");
  if (checkin) metadata.checkin_url = checkin.url;
  const config: Record<string, unknown> = { ...scalarRecord(legacy?.config), ...scalarRecord(render.config) };
  let fileUrl = primaryResource(version)?.url ?? null;
  let text: string | null = typeof legacy?.text_content === "string" ? legacy.text_content : null;
  let name = typeof legacy?.name === "string" ? legacy.name : row.name;
  if (payload?.kind === "text" || payload?.kind === "anchor") text = payload.text ?? text;
  if (payload?.kind === "shop") {
    text = payload.text ?? text;
    name = payload.name ?? name;
  }
  if (payload?.kind === "link") {
    // Same consumer contract as legacy link rows: config.link = LinkAssetData, file_url = preview.
    const link = linkData(payload.url);
    if (link && !scalarRecord(config.link).originalUrl) config.link = link;
    fileUrl = version?.resources.find((r) => r.role === "thumbnail")?.url ?? fileUrl ?? link?.previewUrl ?? null;
  }
  const isHuge = (render.is_huge ?? legacy?.is_huge) === true;
  return { file_type: fileType, file_url: fileUrl, text_content: text, metadata, config, is_huge: isHuge && fileType === "model", name };
}

async function tagIdsFor(exec: Executor, rows: RuntimeRow[], workspaceId: string | null): Promise<Map<string, string[]>> {
  const ids = rows.map((r) => r.id);
  if (!ids.length) return new Map();
  const own = await exec.selectFrom("placement_tag").select(["placement_id", "tag_id"]).where("placement_id", "in", ids).execute();
  const scoped = workspaceId
    ? await exec
        .selectFrom("legacy_content_map as m")
        .innerJoin("legacy_runtime_binding as b", "b.id", "m.binding_id")
        .select(["b.placement_id", "m.tag_ids"])
        .where("b.placement_id", "in", ids)
        .where("m.workspace_id", "=", workspaceId)
        .execute()
    : [];
  const out = new Map<string, string[]>();
  for (const row of rows) {
    const scope = workspaceId && row.workspace_id !== workspaceId ? scoped.find((s) => s.placement_id === row.id) : undefined;
    out.set(row.id, scope ? scope.tag_ids : own.filter((t) => t.placement_id === row.id).map((t) => t.tag_id));
  }
  return out;
}

/** One row per public id (organization-wide queries may reach a binding through several scopes). */
function uniqueByPublicId<T extends { public_id: string; organization_id: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = `${row.organization_id}:${row.public_id}`;
    return seen.has(key) ? false : (seen.add(key), true);
  });
}

// ───────────────────────── endpoints ─────────────────────────

export async function nearbyPlacements(scope: RuntimeScope, lat: number, lng: number, radius: number) {
  const point = sql`ST_SetSRID(ST_MakePoint(${lng}::float8, ${lat}::float8), 4326)::geography`;
  const rows = uniqueByPublicId(
    await runtimeQuery(db, scope)
      .where("p.location", "is not", null)
      .where(sql<boolean>`ST_DWithin(p.location::geography, ${point}, ${radius}::float8)`)
      .select(sql<number>`ST_Distance(p.location::geography, ${point})`.as("distance"))
      .orderBy("distance")
      .execute(),
  );
  const ctx = await projectionContext(db, rows);
  return rows.map((row) => {
    const c = legacyContent(row, ctx);
    return { id: row.public_id, file_type: c.file_type, file_url: c.file_url, text_content: c.text_content, metadata: c.metadata, config: c.config, is_huge: c.is_huge, distance: Number(row.distance) };
  });
}

export async function hugePlacements(scope: RuntimeScope) {
  const rows = uniqueByPublicId(await runtimeQuery(db, scope).where("p.location", "is not", null).where("p.asset_version_id", "is not", null).execute());
  const ctx = await projectionContext(db, rows);
  return rows.flatMap((row) => {
    const c = legacyContent(row, ctx);
    if (!c.is_huge || c.file_type !== "model") return [];
    return [{ id: row.public_id, file_type: c.file_type, file_url: c.file_url, text_content: c.text_content, metadata: c.metadata, config: c.config, latitude: row.latitude, longitude: row.longitude }];
  });
}

/** Shops including directory-only ones without coordinates (plan §4.4 exception). */
export async function shopPlacements(scope: { workspaceId: string; organizationId: string }) {
  const rows = uniqueByPublicId(
    await runtimeQuery(db, scope)
      .innerJoin("asset as sa", "sa.id", "p.asset_id")
      .where("sa.file_type", "=", "shop")
      .where("sa.organization_id", "=", scope.organizationId)
      // Legacy ordering/create_at come from the (preserved) shop identity, not the migration time.
      .select(sql<Date>`coalesce(sa.create_at, p.created_at)`.as("shop_created_at"))
      .orderBy(sql`coalesce(sa.create_at, p.created_at)`, "desc")
      .execute(),
  );
  const [ctx, tags] = await Promise.all([projectionContext(db, rows), tagIdsFor(db, rows, scope.workspaceId)]);
  return rows.map((row) => {
    const c = legacyContent(row, ctx);
    return {
      id: row.public_id,
      name: c.name,
      file_url: c.file_url,
      text_content: c.text_content,
      anchor_id: row.anchor_id,
      tag_ids: tags.get(row.id) ?? [],
      metadata: c.metadata,
      longitude: row.longitude,
      latitude: row.latitude,
      create_at: row.shop_created_at,
    };
  });
}

/** Content attached to a recognized anchor in a project. */
export async function anchorPlacements(workspaceId: string, anchorId: string) {
  const rows = uniqueByPublicId(await runtimeQuery(db, { workspaceId, organizationId: null }).where("p.anchor_id", "=", anchorId).orderBy("p.id").execute());
  const [ctx, tags] = await Promise.all([projectionContext(db, rows), tagIdsFor(db, rows, workspaceId)]);
  return rows.map((row) => {
    const c = legacyContent(row, ctx);
    return {
      id: row.public_id,
      name: c.name,
      file_type: c.file_type,
      file_url: c.file_url,
      text_content: c.text_content,
      anchor_id: row.anchor_id,
      tag_ids: tags.get(row.id) ?? [],
      metadata: c.metadata,
      is_huge: c.is_huge,
      config: c.config,
    };
  });
}

export class RuntimeNotFound extends Error {}

/**
 * Compiled schema-1/2 manifest of a published scene placement, resolved by the
 * discovery id the client already has. `manifest.assetId` echoes that id.
 */
export async function sceneManifest(publicId: string, scope: RuntimeScope): Promise<SceneAssetManifest> {
  const id = publicId.toLowerCase();
  const rows = await runtimeQuery(db, scope)
    .where("p.scene_revision_id", "is not", null)
    .where((eb) => eb.or([eb("b.public_id", "=", id), eb.and([eb("p.id", "=", id), eb("b.id", "is", null)])]))
    .limit(2)
    .execute();
  if (rows.length !== 1 || !rows[0].scene_revision_id) throw new RuntimeNotFound("场景素材不存在");
  const content = await resolvePlacementContent(db, { kind: "scene_revision", sceneRevisionId: rows[0].scene_revision_id });
  if (!content || content.kind !== "scene_revision") throw new RuntimeNotFound("场景素材不存在");
  const resources: Record<string, { assetId: string; url: string }> = {};
  for (const resource of content.resources) {
    if (!resource.url) throw new RuntimeNotFound("场景资源文件缺失");
    resources[resource.resource_alias] = { assetId: resource.asset_id, url: resource.url };
  }
  try {
    return compileSceneManifest(publicId, content.document, resources);
  } catch {
    throw new RuntimeNotFound("场景资源文件缺失");
  }
}

// ───────────────────────── anonymous text ─────────────────────────

export class RuntimeUnavailable extends Error {}

/**
 * Anonymous mini-program text for a cut-over organization: a restricted
 * command that creates a public_submission text asset, its v1 and an active
 * (or, without GPS, draft) placement. The caller gets no catalog or editing
 * rights; field validation and rate limits stay in the route.
 */
export async function submitAnonymousText(input: { content: string; workspaceId: string; organizationId: string | null; lat: number | null; lng: number | null }) {
  const submitter = await db.selectFrom("users").select("user_id").where("email", "=", "dongming@user.com").executeTakeFirst();
  if (!submitter) throw new RuntimeUnavailable("No user found in database");
  const actor: Actor = { userId: submitter.user_id, globalRole: null, superAdmin: false };
  const uploadTime = new Date().toISOString();
  const hasLocation = input.lat !== null && input.lng !== null;
  return contentTransaction(async (trx) => {
    const workspace = await trx
      .selectFrom("workspace as w")
      .innerJoin("organization as o", "o.id", "w.organization_id")
      .select(["w.id", "w.organization_id", "w.archived_at", "o.archived_at as org_archived_at", "o.content_model_state"])
      .where("w.id", "=", input.workspaceId)
      .executeTakeFirst();
    if (!workspace || (input.organizationId && workspace.organization_id !== input.organizationId) || workspace.archived_at || workspace.org_archived_at)
      throw new RuntimeNotFound("Workspace not found or does not belong to the specified organization");
    // Decide on the locked organization row: a freeze committed while we
    // waited must be seen here, not the state read before the lock.
    const org = await trx
      .selectFrom("organization")
      .select(["content_model_state", "archived_at"])
      .where("id", "=", workspace.organization_id)
      .forShare()
      .executeTakeFirst();
    if (!org || org.archived_at) throw new RuntimeNotFound("Workspace not found or does not belong to the specified organization");
    if (org.content_model_state !== "v2") throw new RuntimeUnavailable("organization is not accepting submissions");
    const locked = await trx.selectFrom("workspace").select("archived_at").where("id", "=", workspace.id).forShare().executeTakeFirst();
    if (!locked || locked.archived_at) throw new RuntimeNotFound("Workspace not found or does not belong to the specified organization");
    const asset = await trx
      .insertInto("asset")
      .values({
        organization_id: workspace.organization_id,
        origin_workspace_id: workspace.id,
        maintained_by: null,
        visibility: "restricted",
        state: "active",
        origin: "public_submission",
        file_type: "text",
        name: null,
        created_by: submitter.user_id,
      })
      .returning(["id", "create_at"])
      .executeTakeFirstOrThrow();
    await lockKeys(trx, [grantLockKey(asset.id, workspace.id)]);
    await trx.insertInto("asset_workspace_grant").values({ asset_id: asset.id, workspace_id: workspace.id, organization_id: workspace.organization_id, created_by: null }).execute();
    await appendVersion(
      trx,
      actor,
      { id: asset.id, organization_id: workspace.organization_id },
      {
        kind: "text",
        text: input.content,
        attributes: hasLocation ? { gps_source: "user_input", upload_time: uploadTime } : { upload_time: uploadTime },
        ...(hasLocation ? { capture: { latitude: input.lat!, longitude: input.lng!, source: "user_input" } } : {}),
      },
      [],
      { actorIdForRow: submitter.user_id },
    );
    const version = await trx.selectFrom("asset").select("current_version_id").where("id", "=", asset.id).executeTakeFirstOrThrow();
    const placement = await trx
      .insertInto("placement")
      .values({
        organization_id: workspace.organization_id,
        workspace_id: workspace.id,
        asset_id: asset.id,
        asset_version_id: version.current_version_id,
        location: hasLocation ? pointSql({ longitude: input.lng!, latitude: input.lat! }) : null,
        status: hasLocation ? "active" : "draft",
        created_by: submitter.user_id,
        updated_by: submitter.user_id,
      })
      .returning(["id", "created_at"])
      .executeTakeFirstOrThrow();
    await audit(trx, {
      organizationId: workspace.organization_id,
      actorId: null,
      action: "placement.public_text",
      objectType: "placement",
      objectId: placement.id,
      workspaceId: workspace.id,
      details: { asset_id: asset.id, channel: "miniapp" },
    });
    return {
      id: placement.id,
      file_type: "text",
      text_content: input.content,
      metadata: hasLocation ? { longitude: input.lng, latitude: input.lat, gps_source: "user_input", upload_time: uploadTime } : null,
      create_at: placement.created_at,
    };
  });
}
