import { pathToFileURL } from "node:url";
import type { Client } from "pg";
import { validateSceneDefinition } from "../../../lib/scene/validate";
import { connect, fail, fingerprint, options, output, type MigrationOptions } from "./shared";

export interface LegacyAsset {
  id: string;
  name: string | null;
  file_type: string;
  workspace_id: string[] | null;
  created_by: string | null;
  anchor_id: string | null;
  text_content: string | null;
  file_url: string | null;
  metadata: Record<string, unknown> | null;
  config: Record<string, unknown> | null;
  location: unknown;
  tag_ids: string[] | null;
  is_huge: boolean | null;
  content_hash: string | null;
  [key: string]: unknown;
}

export interface AssetMapping {
  source_id: string;
  source_hash: string;
  dependency_hash: string;
  kind: string;
  dependencies: string[];
  issues: string[];
  disposition: "migrate" | "isolate" | "review";
  targets: {
    organization_id: string;
    workspace_ids: string[];
    target_id: string | null;
    source_workspace_id: string | null;
    maintained_by: string | null;
    create_placement: boolean;
  }[];
}

export interface AuditReport {
  format: "content-model-audit-v1";
  run_id: string;
  environment: string;
  organizations: string[];
  generated_at: string;
  source_fingerprint: string;
  required_organizations: string[];
  residual_scene_tables: string[];
  schema_migrations: string[];
  mappings: AssetMapping[];
  assignments: {
    workspace_id: string; user_id: string; old_role: string; org_role: string | null;
    proposed_role: "manager" | "editor" | "viewer" | null;
    issue: string | null;
  }[];
  summary: { assets: number; review: number; isolated: number; cross_organization: number };
}

export async function audit(client: Client, opts: MigrationOptions): Promise<AuditReport> {
  // One read-only snapshot keeps source rows, dependencies and ownership consistent.
  await client.query("begin isolation level repeatable read read only");
  try {
    const report = await auditSnapshot(client, opts);
    await client.query("commit");
    return report;
  } catch (error) { await client.query("rollback"); throw error; }
}

/** Read within a caller-owned transaction. The caller must hold one consistent
 * snapshot (and migration locks for cutover); this function never commits. */
export async function auditSnapshot(client: Client, opts: MigrationOptions): Promise<AuditReport> {
    const workspaces = (await client.query<{ id: string; organization_id: string }>("select id, organization_id from workspace")).rows;
    const workspaceOrg = new Map(workspaces.map((w) => [w.id, w.organization_id]));
    const organizationIds = new Set((await client.query<{ id: string }>("select id from organization where id = any($1::uuid[])", [opts.organizations])).rows.map((r) => r.id));
    if (organizationIds.size !== opts.organizations.length) throw new Error("One or more requested organizations do not exist");
    const members = (await client.query<{ organization_id: string; user_id: string; role: string }>("select organization_id,user_id,role from organization_member")).rows;
    const memberRoles = new Map(members.map((m) => [`${m.organization_id}:${m.user_id}`, m.role]));
    const hasMigrationMap = (await client.query<{ present: boolean }>("select to_regclass('public.content_migration_map') is not null present")).rows[0].present;
    // Enumerate legacy columns: adding staged v2 identity fields must not change
    // the source fingerprint. Source URLs/config and dependencies still do.
    const assets = (await client.query<LegacyAsset>(`select id,name,file_type,workspace_id,created_by,create_at,
      anchor_id,text_content,file_url,metadata,config,location,tag_ids,is_huge,content_hash,
      GeometryType(location) location_type, ST_SRID(location) location_srid,
      case when GeometryType(location)='POINT' then ST_X(location::geometry) end longitude,
      case when GeometryType(location)='POINT' then ST_Y(location::geometry) end latitude
      from asset a ${hasMigrationMap ? "where not exists (select 1 from content_migration_map m where m.target_kind='asset' and m.target_id=a.id and m.source_id<>a.id)" : ""}
      order by id`)).rows;
    const byId = new Map(assets.map((a) => [a.id, a]));
    const organizationsFor = (a: LegacyAsset) => [...new Set((a.workspace_id ?? []).map((id) => workspaceOrg.get(id)).filter((id): id is string => !!id))].sort();
    const required = new Set(opts.organizations);
    // Historical multi-tenant rows connect cutover units transitively.
    let grew = true;
    while (grew) {
      grew = false;
      for (const asset of assets) {
        const orgs = organizationsFor(asset);
        if (!orgs.some((id) => required.has(id))) continue;
        for (const id of orgs) if (!required.has(id)) { required.add(id); grew = true; }
      }
    }
    const mappings: AssetMapping[] = [];
    for (const asset of assets) {
      const orgs = organizationsFor(asset);
      // Completely orphaned rows cannot be assigned to a tenant: report them explicitly.
      if (orgs.length && !orgs.some((id) => required.has(id))) continue;
      const issues: string[] = [];
      const dependencies: string[] = [];
      if (!orgs.length) issues.push("no_valid_workspace");
      if ((asset.workspace_id ?? []).some((id) => !workspaceOrg.has(id))) issues.push("missing_workspace");
      if (orgs.length > 1) issues.push("cross_organization_identity_requires_review");
      // Before image matching (2026-09-08), spatial anchors had no file. Keep
      // their identities/attachments after acknowledging the missing-image state.
      if (asset.file_type === "anchor" && !asset.file_url) issues.push("legacy_anchor_without_reference_requires_review");
      if (asset.location) {
        if (asset.location_type !== "POINT" || typeof asset.longitude !== "number" || typeof asset.latitude !== "number" ||
          !Number.isFinite(asset.longitude) || !Number.isFinite(asset.latitude) ||
          Math.abs(asset.longitude) > 180 || Math.abs(asset.latitude) > 90) issues.push("invalid_gps_point");
        if (asset.location_srid !== 0 && asset.location_srid !== 4326) issues.push("coordinate_reference_requires_review");
      }
      if (asset.anchor_id) {
        const anchor = byId.get(asset.anchor_id);
        if (!anchor || anchor.file_type !== "anchor") issues.push("missing_or_invalid_anchor");
        else if (orgs.some((org) => !organizationsFor(anchor).includes(org))) issues.push("cross_organization_anchor");
      }
      if (asset.file_type === "scene") {
        try {
          const document = JSON.parse(asset.text_content ?? "");
          if (![1, 2].includes(document.schemaVersion) || document.content?.kind !== "composition" || !document.content.assets || !Array.isArray(document.content.instances)) {
            issues.push("invalid_scene_structure");
          } else {
            if (!validateSceneDefinition(document).ok) issues.push("invalid_scene_content");
            for (const ref of Object.values(document.content.assets) as { assetId?: unknown }[]) {
              if (typeof ref?.assetId !== "string") { issues.push("invalid_scene_reference"); continue; }
              dependencies.push(ref.assetId);
              const model = byId.get(ref.assetId);
              if (!model || model.file_type !== "model" || !model.file_url) issues.push(`missing_model:${ref.assetId}`);
              else if (orgs.some((org) => !organizationsFor(model).includes(org))) issues.push(`cross_organization_model:${ref.assetId}`);
            }
          }
        } catch { issues.push("invalid_scene_json"); }
      }
      const createPlacement = asset.file_type !== "anchor" && (!!asset.location || !!asset.anchor_id || asset.file_type === "shop");
      const targets = orgs.map((org) => {
        const workspaceIds = [...new Set((asset.workspace_id ?? []).filter((id) => workspaceOrg.get(id) === org))].sort();
        if (workspaceIds.length > 1 && (createPlacement || asset.file_type === "scene")) issues.push(`source_workspace_requires_review:${org}`);
        const ownerRole = asset.created_by ? memberRoles.get(`${org}:${asset.created_by}`) : undefined;
        return { organization_id: org, workspace_ids: workspaceIds, target_id: orgs.length === 1 ? asset.id : null,
          source_workspace_id: workspaceIds.length === 1 ? workspaceIds[0] : null,
          maintained_by: ownerRole && ["owner", "admin", "member"].includes(ownerRole) ? asset.created_by : null, create_placement: createPlacement };
      });
      const uniqueDependencies = [...new Set(dependencies)].sort();
      const fatal = issues.some((issue) => !issue.includes("requires_review"));
      mappings.push({ source_id: asset.id, source_hash: fingerprint(asset),
        dependency_hash: fingerprint({ source: asset, dependencies: uniqueDependencies.map((id) => byId.get(id) ?? { id, missing: true }) }),
        kind: asset.file_type, dependencies: uniqueDependencies, issues: [...new Set(issues)],
        disposition: fatal ? "isolate" : issues.length ? "review" : "migrate", targets });
    }
    const hasLegacyRole = (await client.query<{ present: boolean }>(`select exists(select 1 from information_schema.columns
      where table_schema='public' and table_name='workspace_assignment' and column_name='legacy_role') present`)).rows[0].present;
    const assignments = (await client.query<{ workspace_id: string; user_id: string; role: string; org_role: string | null }>(
      `select wa.workspace_id,wa.user_id,${hasLegacyRole ? "coalesce(wa.legacy_role,wa.role)" : "wa.role"} role,om.role org_role from workspace_assignment wa
       join workspace w on w.id=wa.workspace_id
       left join organization_member om on om.user_id=wa.user_id and om.organization_id=w.organization_id
       where w.organization_id=any($1::uuid[]) order by wa.workspace_id,wa.user_id`, [[...required]],
    )).rows.map((row) => {
      const valid = row.org_role !== null && ["owner", "admin", "member", "viewer"].includes(row.org_role);
      const legacyRoleValid = ["member", "manager", "editor", "viewer"].includes(row.role);
      const proposedRole: "manager" | "editor" | "viewer" | null = !valid || !legacyRoleValid ? null : row.org_role === "owner" || row.org_role === "admin" ? "manager" : row.org_role === "viewer" ? "viewer" : "editor";
      return { workspace_id: row.workspace_id, user_id: row.user_id, old_role: row.role, org_role: row.org_role,
        proposed_role: proposedRole, issue: !valid ? "not_an_organization_member" : !legacyRoleValid ? "unknown_legacy_role" : null };
    });
    const tables = (await client.query<{ tablename: string }>("select tablename from pg_tables where schemaname='public' and tablename like 'scene%' order by tablename")).rows.map((r) => r.tablename);
    const ledger = (await client.query<{ name: string }>("select name from schema_migrations order by name")).rows.map((r) => r.name);
    const report: AuditReport = {
      format: "content-model-audit-v1", run_id: opts.runId, environment: opts.environment, organizations: opts.organizations,
      generated_at: new Date().toISOString(), source_fingerprint: fingerprint({
        assets: mappings.map((m) => [m.source_id, m.dependency_hash, m.targets]), assignments,
        workspaces: workspaces.filter((w) => required.has(w.organization_id)).sort((a, b) => a.id.localeCompare(b.id)),
      }),
      required_organizations: [...required].sort(), residual_scene_tables: tables, schema_migrations: ledger, mappings, assignments,
      summary: { assets: mappings.length, review: mappings.filter((m) => m.disposition === "review").length,
        isolated: mappings.filter((m) => m.disposition === "isolate").length, cross_organization: mappings.filter((m) => m.targets.length > 1).length },
    };
    return report;
}

async function main() {
  const opts = options();
  if (opts.apply) throw new Error("audit is always read-only; --apply is not accepted");
  const client = await connect(opts);
  try { output(await audit(client, opts), opts.output); }
  finally { await client.end(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(fail);
