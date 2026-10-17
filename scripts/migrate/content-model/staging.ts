import type { Client } from "pg";
import type { AssetMapping, LegacyAsset } from "./audit";
import type { ModelAnimationInfo } from "../../../lib/content-model/contracts";
import type { SceneDefinition, SceneDocumentV3 } from "../../../lib/scene/protocol";
import { validateSceneDefinition } from "../../../lib/scene/validate";
import { fingerprint, type MigrationOptions } from "./shared";
import { enumerateResources, stableId, type MappingTarget, type MigrationReview, type ResourceSnapshot } from "./review";

export const sourceKind = (mapping: AssetMapping): string => mapping.kind === "scene" ? "scene_asset" : ["shop","anchor","text"].includes(mapping.kind) ? mapping.kind : "asset";
export async function migrationLock(client: Client, opts: MigrationOptions): Promise<void> {
  for (const id of opts.organizations) await client.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [`content-migration:${id}`]);
  // Also drains transactions that passed the old trigger before readonly was committed.
  // Kept bounded by statement/lock timeouts; no per-row lock can drain legacy bulk writes.
  await client.query("lock table asset, workspace, workspace_assignment, organization_member in share row exclusive mode");
  await client.query("select id from organization where id=any($1::uuid[]) order by id for update", [opts.organizations]);
  await client.query("select set_config('content_model.writer','migration',true)");
}
export async function recordMap(client: Client, opts: MigrationOptions, mapping: AssetMapping, target: MappingTarget | null, kind: string | null, id: string | null, status = "staged", reason: string | null = null): Promise<void> {
  await client.query(`insert into content_migration_map(run_id,source_kind,source_id,source_workspace_id,source_row_hash,target_organization_id,target_kind,target_id,status,reason)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    on conflict on constraint content_migration_map_unique do update set run_id=excluded.run_id,source_workspace_id=excluded.source_workspace_id,
      source_row_hash=excluded.source_row_hash,target_id=excluded.target_id,status=excluded.status,reason=excluded.reason,updated_at=now()`,
  [opts.runId,sourceKind(mapping),mapping.source_id,target?.source_workspace_id ?? null,mapping.dependency_hash,target?.organization_id ?? null,kind,id,status,reason]);
}
function legacyModelAnimations(source: LegacyAsset): ModelAnimationInfo[] | undefined {
  const value = source.metadata?.gltf;
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const cache = value as Record<string,unknown>;
  // Only project a validated cache for this exact file. Unknown/stale metadata
  // remains in migration_legacy; it must not imply a known empty clip catalog.
  if (!source.file_url || !source.content_hash || cache.fileUrl !== source.file_url || cache.contentHash !== source.content_hash ||
      !Array.isArray(cache.animations) || cache.animations.length > 64) return undefined;
  const animations: ModelAnimationInfo[] = [];
  for (const value of cache.animations) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
    const entry = value as Record<string,unknown>;
    if (typeof entry.index !== "number" || !Number.isInteger(entry.index) || entry.index < 0 || entry.index > 1000 ||
        typeof entry.name !== "string" || entry.name.length > 200) return undefined;
    if (entry.durationSeconds !== undefined &&
        (typeof entry.durationSeconds !== "number" || !Number.isFinite(entry.durationSeconds) || entry.durationSeconds < 0)) return undefined;
    animations.push({index:entry.index,name:entry.name,...(entry.durationSeconds !== undefined ? {duration_seconds:entry.durationSeconds as number} : {})});
  }
  return animations;
}
export function legacyPayload(source: LegacyAsset): Record<string,unknown> {
  const payload: Record<string,unknown> = {kind:source.file_type,migration_legacy:{metadata:source.metadata,config:source.config,text_content:source.text_content,name:source.name,file_url:source.file_url,is_huge:source.is_huge}};
  if (["text","shop","anchor"].includes(source.file_type)) payload.text = source.text_content ?? "";
  if (source.file_type === "shop") payload.name = source.name ?? "";
  if (source.file_type === "link") {
    const config = source.config?.link as Record<string,unknown> | undefined;
    payload.url = config?.originalUrl ?? source.file_url ?? source.text_content ?? "";
  }
  if (source.file_type === "model") {
    const animations = legacyModelAnimations(source);
    if (animations !== undefined) payload.animations = animations;
  }
  // Keep ordinary scalar properties visible in the v2 detail UI, retaining the
  // exact nested legacy projection above exclusively for immutable migration data.
  payload.attributes = Object.fromEntries(Object.entries(source.metadata ?? {}).filter(([,v]) => v === null || ["boolean","number"].includes(typeof v) || (typeof v === "string" && !/^https?:\/\//.test(v))));
  return payload;
}
export async function stageAsset(client: Client, opts: MigrationOptions, mapping: AssetMapping, target: MappingTarget, source: LegacyAsset, resources: ResourceSnapshot[]): Promise<string> {
  const targetId = target.target_id!;
  const existing = (await client.query<{organization_id:string|null}>("select organization_id from asset where id=$1", [targetId])).rows[0];
  if (existing && targetId !== source.id) {
    const belongs = await client.query("select 1 from content_migration_map where source_id=$1 and target_id=$2 and target_kind='asset' and target_organization_id=$3", [source.id,targetId,target.organization_id]);
    if (!belongs.rowCount) throw new Error("Target asset ID is already occupied");
  }
  if (existing?.organization_id && existing.organization_id !== target.organization_id) throw new Error("Staged ownership cannot be reassigned; restore/review the original split mapping");
  if (!existing) {
    await client.query(`insert into asset(id,created_by,create_at,file_type,file_url,text_content,metadata,workspace_id,name,config,content_hash,organization_id,origin_workspace_id,maintained_by)
      values($1,$2,$3,$4,$5,$6,$7,'{}',$8,$9,$10,$11,$12,$13)`,
    [targetId,source.created_by,source.create_at,source.file_type,source.file_url,source.text_content,source.metadata,source.name,source.config,source.content_hash,target.organization_id,target.source_workspace_id,target.maintained_by]);
  } else await client.query(`update asset set organization_id=$2,origin_workspace_id=$3,maintained_by=$4,visibility='restricted',origin='legacy',state='active',name=$5,file_type=$6 where id=$1`,[targetId,target.organization_id,target.source_workspace_id,target.maintained_by,source.name,source.file_type]);
  await recordMap(client,opts,mapping,target,"asset",targetId);
  await client.query("delete from asset_workspace_grant where asset_id=$1 and not(workspace_id=any($2::uuid[]))",[targetId,target.workspace_ids]);
  for (const workspaceId of target.workspace_ids) await client.query(`insert into asset_workspace_grant(asset_id,workspace_id,organization_id) values($1,$2,$3) on conflict do nothing`,[targetId,workspaceId,target.organization_id]);
  const payload = legacyPayload(source);
  const sourceFingerprint = fingerprint({source:mapping.source_hash,payload,resources});
  const versionId = stableId("migration-version",targetId,sourceFingerprint);
  const version = await client.query("select id from asset_version where asset_id=$1 and source_fingerprint=$2",[targetId,sourceFingerprint]);
  if (!version.rowCount) {
    for (const key of [...new Set(resources.flatMap((r) => !r.storage_key ? [] : /\.(webm|m4a)$/i.test(r.storage_key) ? [r.storage_key,r.storage_key.replace(/\.(webm|m4a)$/i,".webm"),r.storage_key.replace(/\.(webm|m4a)$/i,".m4a")] : [r.storage_key]))].sort()) await client.query("select pg_advisory_xact_lock(hashtextextended($1,0))",[`object-key:${key}`]);
    await client.query(`insert into asset_version(id,asset_id,organization_id,version_no,payload,created_by,source_fingerprint)
      select $1,$2,$3,coalesce(max(version_no),0)+1,$4,$5,$6 from asset_version where asset_id=$2`,[versionId,targetId,target.organization_id,payload,source.created_by,sourceFingerprint]);
    for (const r of resources) await client.query(`insert into asset_version_resource(asset_version_id,role,ordinal,storage_key,external_url,content_hash,mime_type,size_bytes) values($1,$2,$3,$4,$5,$6,$7,$8)`,[versionId,r.role,r.ordinal,r.storage_key,r.external_url,r.content_hash,r.mime_type,r.size_bytes]);
  }
  const resolvedId = version.rows[0]?.id ?? versionId;
  await client.query("update asset set current_version_id=$2 where id=$1",[targetId,resolvedId]);
  await recordMap(client,opts,mapping,target,"asset_version",resolvedId);
  return resolvedId;
}
export async function stageScene(client: Client, opts: MigrationOptions, review: MigrationReview, mapping: AssetMapping, target: MappingTarget, source: LegacyAsset, versions: Map<string,string>): Promise<string | null> {
  const legacy = JSON.parse(source.text_content!) as SceneDefinition;
  if (!validateSceneDefinition(legacy).ok) throw new Error("Invalid legacy scene cannot be staged");
  const document: SceneDocumentV3 = {schemaVersion:3,content:{...legacy.content,assets:{}}};
  for (const [alias,ref] of Object.entries(legacy.content.assets)) {
    const model = review.mappings.find((m) => m.source_id === ref.assetId && m.disposition === "migrate");
    const modelTarget = model?.targets.find((t) => t.organization_id === target.organization_id);
    const versionId = versions.get(`${target.organization_id}:${ref.assetId}`);
    if (!modelTarget?.target_id || !versionId) throw new Error(`Scene dependency is isolated or missing: ${ref.assetId}`);
    document.content.assets[alias] = {assetId:modelTarget.target_id,assetVersionId:versionId};
  }
  const sceneId = target.target_id!;
  const existing = (await client.query<{organization_id:string;draft_document:unknown;name:string;lock_version:number}>("select organization_id,draft_document,name,lock_version from scene where id=$1",[sceneId])).rows[0];
  let lockVersion = 1;
  const name = source.name?.trim().slice(0,200) || "迁移场景";
  if (existing) {
    const mapped = await client.query("select 1 from content_migration_map where source_id=$1 and target_kind='scene' and target_id=$2 and target_organization_id=$3",[source.id,sceneId,target.organization_id]);
    if (existing.organization_id !== target.organization_id || !mapped.rowCount) throw new Error("Target scene ID is already occupied");
    const changed = fingerprint(existing.draft_document) !== fingerprint(document) || existing.name !== name;
    lockVersion = existing.lock_version + (changed ? 1 : 0);
    await client.query("update scene set draft_document=$2,name=$3,workspace_id=$4,lock_version=$5,state='active',updated_at=now() where id=$1",[sceneId,document,name,target.source_workspace_id,lockVersion]);
  } else await client.query(`insert into scene(id,organization_id,workspace_id,name,draft_document,created_by,legacy_asset_id) values($1,$2,$3,$4,$5,$6,$7)`,[sceneId,target.organization_id,target.source_workspace_id,name,document,source.created_by,source.id]);
  await recordMap(client,opts,mapping,target,"scene",sceneId);
  await client.query("delete from scene_asset_ref where scene_id=$1",[sceneId]);
  for (const [alias,ref] of Object.entries(document.content.assets)) await client.query("insert into scene_asset_ref(scene_id,organization_id,resource_alias,asset_id,asset_version_id) values($1,$2,$3,$4,$5)",[sceneId,target.organization_id,alias,ref.assetId,ref.assetVersionId]);
  if (!target.create_placement) return null;
  const revisionId = stableId("migration-revision",sceneId,String(lockVersion));
  await client.query(`insert into scene_revision(id,scene_id,organization_id,revision_no,source_lock_version,name,document,created_by)
    select $1,$2,$3,coalesce(max(revision_no),0)+1,$4,$5,$6,$7 from scene_revision where scene_id=$2 on conflict(scene_id,source_lock_version) do nothing`,[revisionId,sceneId,target.organization_id,lockVersion,name,document,source.created_by]);
  for (const [alias,ref] of Object.entries(document.content.assets)) await client.query("insert into scene_revision_asset_ref(scene_revision_id,organization_id,resource_alias,asset_id,asset_version_id) values($1,$2,$3,$4,$5) on conflict do nothing",[revisionId,target.organization_id,alias,ref.assetId,ref.assetVersionId]);
  await recordMap(client,opts,mapping,target,"scene_revision",revisionId);
  return revisionId;
}
export function legacyAltitude(source: Pick<LegacyAsset, "metadata">): number | null {
  // Legacy upload/drag and Cesium rendering use metadata.height in meters.
  // Preserve an explicit finite altitude first, including zero; never coerce text.
  for (const value of [source.metadata?.altitude, source.metadata?.height]) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}
export async function stagePlacement(client: Client, opts: MigrationOptions, mapping: AssetMapping, target: MappingTarget, source: LegacyAsset, fixedId: string): Promise<void> {
  const placementId = stableId("migration-placement",target.organization_id,source.id);
  const render = {config:source.config ?? {},is_huge:source.is_huge ?? false};
  const scene = mapping.kind === "scene";
  await client.query(`insert into placement(id,organization_id,workspace_id,name,asset_id,asset_version_id,scene_revision_id,location,altitude,anchor_id,render_config,status,created_by)
    values($1,$2,$3,$4,$5,$6,$7,case when $8::float8 is null then null else ST_SetSRID(ST_MakePoint($8,$9),4326) end,$10,$11,$12,'active',$13)
    on conflict(id) do update set workspace_id=excluded.workspace_id,name=excluded.name,asset_id=excluded.asset_id,asset_version_id=excluded.asset_version_id,
      scene_revision_id=excluded.scene_revision_id,location=excluded.location,altitude=excluded.altitude,anchor_id=excluded.anchor_id,render_config=excluded.render_config,status='active',updated_at=now()`,
  [placementId,target.organization_id,target.source_workspace_id,source.name,scene ? null : target.target_id,scene ? null : fixedId,scene ? fixedId : null,source.longitude ?? null,source.latitude ?? null,legacyAltitude(source),source.anchor_id,render,source.created_by]);
  await recordMap(client,opts,mapping,target,"placement",placementId);
  const bindingId = stableId("migration-binding",target.organization_id,source.id);
  await client.query(`insert into legacy_runtime_binding(id,organization_id,public_id,placement_id,legacy_asset_id) values($1,$2,$3,$4,$3) on conflict(organization_id,public_id) do nothing`,[bindingId,target.organization_id,source.id,placementId]);
  await recordMap(client,opts,mapping,target,"binding",bindingId);
  await client.query("delete from legacy_content_map where binding_id=$1",[bindingId]);
  await client.query("delete from placement_tag where placement_id=$1",[placementId]);
  for (const workspace of target.workspace_ids) {
    const tags = (await client.query<{id:string}>("select id from tag where workspace_id=$1 and id=any($2::uuid[]) order by id",[workspace,source.tag_ids ?? []])).rows.map((t) => t.id);
    await client.query("insert into legacy_content_map(binding_id,organization_id,public_id,workspace_id,tag_ids) values($1,$2,$3,$4,$5)",[bindingId,target.organization_id,source.id,workspace,tags]);
    if (workspace === target.source_workspace_id) for (const tag of tags) await client.query("insert into placement_tag(placement_id,tag_id,workspace_id) values($1,$2,$3)",[placementId,tag,workspace]);
  }
}
export async function stageSources(client: Client, opts: MigrationOptions, review: MigrationReview, sources: Map<string,LegacyAsset>): Promise<void> {
  const versions = new Map<string,string>();
  for (const mapping of review.mappings) {
    if (mapping.disposition === "isolate") { await recordMap(client,opts,mapping,null,null,null,"quarantined",review.review_notes[mapping.source_id]); continue; }
    if (mapping.kind === "scene") continue;
    const source = sources.get(mapping.source_id)!;
    const resources = enumerateResources(source,review);
    for (const target of mapping.targets) versions.set(`${target.organization_id}:${source.id}`,await stageAsset(client,opts,mapping,target,source,resources));
  }
  for (const mapping of review.mappings.filter((m) => m.disposition === "migrate")) {
    const source = sources.get(mapping.source_id)!;
    for (const target of mapping.targets) {
      const fixedId = mapping.kind === "scene" ? await stageScene(client,opts,review,mapping,target,source,versions) : versions.get(`${target.organization_id}:${source.id}`)!;
      if (target.create_placement && fixedId) await stagePlacement(client,opts,mapping,target,source,fixedId);
    }
  }
}
