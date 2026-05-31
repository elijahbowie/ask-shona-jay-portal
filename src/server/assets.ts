import type { DownloadAsset } from "../shared/types";
import { all, first, mapAsset, run, tenantId } from "./db";
import { allowedVisibilityTiers } from "./vector";

export async function assetsForSlug(env: Env, slug: string, tier: string): Promise<DownloadAsset[]> {
  const tiers = allowedVisibilityTiers(tier);
  const placeholders = tiers.map(() => "?").join(", ");
  const rows = await all<any>(
    env,
    `SELECT * FROM download_assets
     WHERE tenant_id = ? AND linked_slug = ? AND status = 'published'
       AND visibility_tier IN (${placeholders})
     ORDER BY sort_order ASC, title ASC`,
    tenantId(),
    slug,
    ...tiers
  );
  return rows.map(mapAsset);
}

export async function publishedAssets(env: Env, tier: string): Promise<DownloadAsset[]> {
  const tiers = allowedVisibilityTiers(tier);
  const placeholders = tiers.map(() => "?").join(", ");
  const rows = await all<any>(
    env,
    `SELECT * FROM download_assets
     WHERE tenant_id = ? AND status = 'published'
       AND visibility_tier IN (${placeholders})
     ORDER BY sort_order ASC, title ASC`,
    tenantId(),
    ...tiers
  );
  return rows.map(mapAsset);
}

export async function assetForDownload(env: Env, assetId: string, tier: string): Promise<any | null> {
  const tiers = allowedVisibilityTiers(tier);
  const placeholders = tiers.map(() => "?").join(", ");
  return first<any>(
    env,
    `SELECT * FROM download_assets
     WHERE tenant_id = ? AND id = ? AND status = 'published'
       AND visibility_tier IN (${placeholders})
     LIMIT 1`,
    tenantId(),
    assetId,
    ...tiers
  );
}

export async function adminListAssets(env: Env): Promise<DownloadAsset[]> {
  const rows = await all<any>(
    env,
    `SELECT * FROM download_assets
     WHERE tenant_id = ?
     ORDER BY linked_slug ASC, sort_order ASC, title ASC`,
    tenantId()
  );
  return rows.map(mapAsset);
}

export async function deleteAsset(env: Env, assetId: string): Promise<string | null> {
  const row = await first<any>(
    env,
    "SELECT r2_key FROM download_assets WHERE tenant_id = ? AND id = ? LIMIT 1",
    tenantId(),
    assetId
  );
  if (!row) return null;
  await run(env, "DELETE FROM download_assets WHERE tenant_id = ? AND id = ?", tenantId(), assetId);
  return row.r2_key;
}

export function contentDisposition(filename: string): string {
  const safe = filename.replace(/[/\\\r\n"]/g, "_");
  return `attachment; filename="${safe}"`;
}
