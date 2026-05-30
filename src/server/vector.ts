import type { ClientProfile } from "../shared/types";
import { all, recordAuditEvent, tenantId, type AuditAction } from "./db";

interface VectorChunkRow {
  id: string;
  tenant_id: string;
  wiki_page_id: string;
  source_id: string;
  vector_id: string;
  text: string;
  published: number;
  visibility: string;
  visibility_tier: string;
  source_type: string;
  strategy_key: string;
  effective_year: string;
  content_version: string;
}

const EMBEDDING_MODEL = "@cf/baai/bge-base-en-v1.5";

export function allowedVisibilityTiers(tier: string): string[] {
  if (tier === "high") {
    return ["all", "low", "mid", "high"];
  }
  if (tier === "mid") {
    return ["all", "low", "mid"];
  }
  return ["all", "low"];
}

export async function upsertPublishedWikiVectors(env: Env, wikiId: string, actor = "system"): Promise<number> {
  const chunks = await all<VectorChunkRow>(
    env,
    `SELECT * FROM knowledge_chunks
     WHERE tenant_id = ? AND wiki_page_id = ? AND published = 1
     ORDER BY chunk_index ASC`,
    tenantId(),
    wikiId
  );
  if (chunks.length === 0) {
    return 0;
  }

  const embeddings = await embedTexts(env, chunks.map((chunk) => chunk.text));
  if (!embeddings) {
    await recordVectorAudit(env, actor, wikiId, "vector.skip", "Workers AI embeddings were unavailable; D1 retrieval fallback remains active.");
    return 0;
  }

  const vectors = chunks.map((chunk, index) => ({
    id: chunk.vector_id,
    values: embeddings[index],
    metadata: {
      tenant_id: chunk.tenant_id,
      chunk_id: chunk.id,
      wiki_page_id: chunk.wiki_page_id,
      source_id: chunk.source_id,
      published: Boolean(chunk.published),
      visibility: chunk.visibility,
      visibility_tier: chunk.visibility_tier,
      source_type: chunk.source_type,
      strategy_key: chunk.strategy_key,
      effective_year: chunk.effective_year,
      content_version: chunk.content_version
    }
  }));

  try {
    await env.VECTOR_INDEX.upsert(vectors);
  } catch {
    await recordVectorAudit(env, actor, wikiId, "vector.skip", "Vectorize upsert was unavailable; D1 retrieval fallback remains active.");
    return 0;
  }
  await recordVectorAudit(env, actor, wikiId, "vector.upsert", `Upserted ${vectors.length} published knowledge vectors.`);
  return vectors.length;
}

export async function queryVectorScores(env: Env, client: ClientProfile, question: string): Promise<Map<string, number>> {
  const embeddings = await embedTexts(env, [question]);
  if (!embeddings?.[0]) {
    return new Map();
  }

  const tiers = allowedVisibilityTiers(client.tier);
  let matches: VectorizeMatches;
  try {
    matches = await env.VECTOR_INDEX.query(embeddings[0], {
      topK: 12,
      returnMetadata: "indexed",
      filter: {
        tenant_id: tenantId(),
        published: true,
        visibility: { $in: ["client", "public"] },
        visibility_tier: { $in: tiers }
      }
    });
  } catch {
    return new Map();
  }

  const scores = new Map<string, number>();
  for (const match of matches.matches) {
    const chunkId = typeof match.metadata?.chunk_id === "string" ? match.metadata.chunk_id : null;
    if (chunkId) {
      scores.set(chunkId, Math.max(scores.get(chunkId) ?? 0, match.score));
    }
  }
  return scores;
}

async function embedTexts(env: Env, texts: string[]): Promise<number[][] | null> {
  if (!texts.length || !env.AI || !env.VECTOR_INDEX) {
    return null;
  }
  try {
    const result = await env.AI.run(EMBEDDING_MODEL, { text: texts });
    const data = (result as { data?: number[][] }).data;
    if (!Array.isArray(data) || data.length !== texts.length) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

async function recordVectorAudit(env: Env, actor: string, wikiId: string, action: AuditAction, detail: string): Promise<void> {
  await recordAuditEvent(env, {
    actor,
    action,
    targetType: "wiki_page",
    targetId: wikiId,
    metadata: { detail }
  });
}
