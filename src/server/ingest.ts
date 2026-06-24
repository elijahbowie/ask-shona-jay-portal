import { createId, nowIso, sha256 } from "./crypto";
import { first, recordAuditEvent, run, tenantId } from "./db";
import type { SourceType } from "../shared/types";
import { upsertPublishedWikiVectors } from "./vector";

export interface SourceInput {
  title: string;
  sourceType: SourceType;
  content: string;
  visibility: string;
  visibilityTier: string;
  strategyKey: string;
  effectiveYear: string;
  audience: string;
  reviewOwner: string;
}

export async function createSource(env: Env, input: SourceInput): Promise<string> {
  const now = nowIso();
  const sourceId = createId("src");
  const contentHash = await sha256(input.content);
  const versionHash = await sha256(`${tenantId()}:${input.title}:${contentHash}`);
  const existing = await first<{ id: string }>(
    env,
    "SELECT id FROM source_documents WHERE tenant_id = ? AND version_hash = ? LIMIT 1",
    tenantId(),
    versionHash
  );
  if (existing) {
    return existing.id;
  }
  const r2Key = `raw/${tenantId()}/${sourceId}/${contentHash}.md`;
  await env.CONTENT_BUCKET.put(r2Key, input.content, {
    httpMetadata: { contentType: "text/markdown; charset=utf-8" },
    customMetadata: {
      tenant_id: tenantId(),
      source_id: sourceId,
      content_hash: contentHash
    }
  });
  await run(
    env,
    `INSERT INTO source_documents (
      id, tenant_id, title, source_type, r2_key, normalized_r2_key, content_hash, version_hash,
      status, visibility, visibility_tier, strategy_key, effective_year, audience, review_owner,
      error_message, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    sourceId,
    tenantId(),
    input.title,
    input.sourceType,
    r2Key,
    null,
    contentHash,
    versionHash,
    "uploaded",
    input.visibility,
    input.visibilityTier,
    input.strategyKey,
    input.effectiveYear,
    input.audience,
    input.reviewOwner,
    null,
    now,
    now
  );
  return sourceId;
}

export async function processSource(env: Env, sourceId: string, actor: string): Promise<string> {
  const source = await first<any>(env, "SELECT * FROM source_documents WHERE tenant_id = ? AND id = ? LIMIT 1", tenantId(), sourceId);
  if (!source) {
    throw new Error("Source not found");
  }
  if (source.status === "draft_ready" || source.status === "published") {
    const existing = await first<any>(env, "SELECT id FROM wiki_pages WHERE tenant_id = ? AND source_id = ? ORDER BY created_at DESC LIMIT 1", tenantId(), sourceId);
    if (existing) {
      return existing.id;
    }
  }
  await run(env, "UPDATE source_documents SET status = ?, updated_at = ? WHERE id = ?", "processing", nowIso(), sourceId);
  const sourceObject = await env.CONTENT_BUCKET.get(source.r2_key);
  if (!sourceObject) {
    await markSourceFailed(env, sourceId, "Source object missing from R2");
    throw new Error("Source object missing from R2");
  }
  const raw = await sourceObject.text();
  const normalized = normalizeSource(raw, source.title);
  const normalizedKey = `normalized/${tenantId()}/${sourceId}/${source.content_hash}.md`;
  await env.CONTENT_BUCKET.put(normalizedKey, normalized, { httpMetadata: { contentType: "text/markdown; charset=utf-8" } });
  const wikiMarkdown = compileWikiPage(source.title, normalized, source.strategy_key);
  const wikiId = createId("wiki");
  const compiledKey = `compiled/pages/${tenantId()}/${wikiId}/${source.content_hash}.md`;
  const slug = slugify(source.title);
  const summary = summarize(normalized);
  await env.CONTENT_BUCKET.put(compiledKey, wikiMarkdown, { httpMetadata: { contentType: "text/markdown; charset=utf-8" } });

  const now = nowIso();
  await run(
    env,
    `INSERT INTO wiki_pages (
      id, tenant_id, source_id, slug, title, summary, compiled_r2_key, status, visibility,
      visibility_tier, strategy_key, effective_year, approved_by, approved_at, published_at,
      version_hash, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    wikiId,
    tenantId(),
    sourceId,
    slug,
    source.title,
    summary,
    compiledKey,
    "draft",
    source.visibility,
    source.visibility_tier,
    source.strategy_key,
    source.effective_year,
    null,
    null,
    null,
    source.version_hash,
    now,
    now
  );

  const chunks = chunkText(normalized);
  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    const chunkId = createId("chunk");
    const citation = {
      sourceId,
      sourceTitle: source.title,
      sourceType: source.source_type,
      wikiPageId: wikiId,
      quoteSpan: chunk.slice(0, 220),
      timestamp: source.source_type === "transcript" ? `segment ${index + 1}` : null,
      clientVisibleUrl: `/trainings/${slug}`,
      confidence: 0.86
    };
    await run(
      env,
      `INSERT INTO knowledge_chunks (
        id, tenant_id, wiki_page_id, source_id, vector_id, corpus, chunk_index, text, citation_json,
        published, visibility, visibility_tier, source_type, strategy_key, effective_year,
        requires_review, content_version, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      chunkId,
      tenantId(),
      wikiId,
      sourceId,
      `vector_${chunkId}`,
      "wiki_chunks",
      index,
      chunk,
      JSON.stringify(citation),
      0,
      source.visibility,
      source.visibility_tier,
      source.source_type,
      source.strategy_key,
      source.effective_year,
      0,
      source.version_hash,
      now
    );
  }

  await run(env, "UPDATE source_documents SET status = ?, normalized_r2_key = ?, updated_at = ? WHERE id = ?", "draft_ready", normalizedKey, now, sourceId);
  await recordAuditEvent(env, {
    actor,
    action: "source.ingest",
    targetType: "source",
    targetId: sourceId,
    metadata: { wikiId },
    at: now
  });
  return wikiId;
}

export async function publishWikiPage(env: Env, wikiId: string, actor: string): Promise<void> {
  const page = await first<any>(env, "SELECT * FROM wiki_pages WHERE tenant_id = ? AND id = ? LIMIT 1", tenantId(), wikiId);
  if (!page) {
    throw new Error("Wiki page not found");
  }
  const now = nowIso();
  await run(
    env,
    "UPDATE wiki_pages SET status = ?, approved_by = ?, approved_at = ?, published_at = ?, updated_at = ? WHERE id = ?",
    "published",
    actor,
    now,
    now,
    now,
    wikiId
  );
  await run(env, "UPDATE knowledge_chunks SET published = 1 WHERE wiki_page_id = ? AND tenant_id = ?", wikiId, tenantId());
  await upsertPublishedWikiVectors(env, wikiId, actor);
  await run(env, "UPDATE source_documents SET status = ?, updated_at = ? WHERE id = ?", "published", now, page.source_id);
  await recordAuditEvent(env, {
    actor,
    action: "wiki.publish",
    targetType: "wiki_page",
    targetId: wikiId,
    metadata: { sourceId: page.source_id },
    at: now
  });
}

export async function updateWikiPage(env: Env, wikiId: string, markdown: string, actor: string): Promise<void> {
  const page = await first<any>(env, "SELECT * FROM wiki_pages WHERE tenant_id = ? AND id = ? LIMIT 1", tenantId(), wikiId);
  if (!page) {
    throw new Error("Wiki page not found");
  }
  const hash = await sha256(markdown);
  const key = `compiled/pages/${tenantId()}/${wikiId}/${hash}.md`;
  await env.CONTENT_BUCKET.put(key, markdown, { httpMetadata: { contentType: "text/markdown; charset=utf-8" } });
  const title = titleFromMarkdown(markdown) || page.title;
  await run(
    env,
    "UPDATE wiki_pages SET title = ?, compiled_r2_key = ?, summary = ?, status = ?, version_hash = ?, updated_at = ? WHERE id = ?",
    title,
    key,
    summarize(markdown),
    "approved",
    hash,
    nowIso(),
    wikiId
  );
  await recordAuditEvent(env, {
    actor,
    action: "wiki.edit",
    targetType: "wiki_page",
    targetId: wikiId,
    metadata: { contentHash: hash }
  });
}

async function markSourceFailed(env: Env, sourceId: string, message: string): Promise<void> {
  await run(env, "UPDATE source_documents SET status = ?, error_message = ?, updated_at = ? WHERE id = ?", "failed", message, nowIso(), sourceId);
}

const PROMPT_INJECTION_LINE_PATTERNS = [
  /\bignore (all )?(previous|prior|above) (instructions|system messages|rules)\b/i,
  /\bdisregard (all )?(previous|prior|above) (instructions|system messages|rules)\b/i,
  /\byou are now\b/i,
  /\breveal (the )?(system prompt|developer message|hidden instructions)\b/i,
  /\bdelete (all )?(data|records|files)\b/i,
  /\bsend (the )?(secrets|api keys|passwords)\b/i,
  /\bdo not cite\b/i
];

export function sanitizeSourceText(raw: string): string {
  return raw
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (PROMPT_INJECTION_LINE_PATTERNS.some((pattern) => pattern.test(trimmed))) {
        return "[Removed unsafe instruction-like text from uploaded source.]";
      }
      return line;
    })
    .join("\n");
}

function normalizeSource(raw: string, title: string): string {
  const cleaned = sanitizeSourceText(raw)
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (cleaned.startsWith("#")) {
    return cleaned;
  }
  return `# ${title}\n\n${cleaned}`;
}

function compileWikiPage(title: string, normalized: string, strategyKey: string): string {
  const body = normalized.replace(/^# .+\n*/, "").trim();
  return `# ${title}

## Strategy Overview

${body}

## When Clients Should Use This

This page supports questions about ${strategyKey.replace(/-/g, " ")} when the client's facts match the approved source material.

## Implementation Checklist

- Read the full guidance and compare the examples to the client's facts.
- Keep documentation before implementing the strategy.
- Escalate when payroll, entity structure, deadlines, controversy, filings, or unusual facts are involved.

## Escalation Rule

If the answer would require personalized tax planning or a filing position, the portal should route the question to your advisor for review.
`;
}

function chunkText(text: string): string[] {
  const paragraphs = text
    .replace(/^# .+\n*/, "")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let current = "";
  for (const paragraph of paragraphs) {
    if ((current + "\n\n" + paragraph).length > 900 && current.length > 0) {
      chunks.push(current);
      current = paragraph;
    } else {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
    }
  }
  if (current) {
    chunks.push(current);
  }
  return chunks.length > 0 ? chunks : [text.slice(0, 900)];
}

function summarize(text: string): string {
  const plain = text
    .replace(/^# .+\n*/, "")
    .replace(/^## .+$/gm, "")
    .replace(/^#+\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
  return plain.slice(0, 260);
}

function titleFromMarkdown(markdown: string): string | null {
  const match = markdown.match(/^#\s+(.+)$/m);
  const title = match?.[1]?.replace(/\s+#*$/g, "").trim();
  return title || null;
}

function slugify(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || createId("page");
}
