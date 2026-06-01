import { describe, expect, it } from "vitest";
import { runHealthChecks } from "./health";

function createHealthTestEnv() {
  const findings = new Set<string>();
  const auditRuns: unknown[] = [];
  const env = {
    DB: {
      prepare: (sql: string) => ({
        bind: (...binds: unknown[]) => ({
          all: async () => {
            if (sql.includes("FROM wiki_pages") && sql.includes("status IN")) {
              return { results: [{ id: "wiki_draft", title: "Draft Strategy" }] };
            }
            if (sql.includes("FROM source_documents")) {
              return { results: [{ id: "src_orphan", title: "Orphan Source" }] };
            }
            if (sql.includes("FROM conversations")) {
              return { results: [{ question: "What about a missing strategy?", total: 1 }] };
            }
            return { results: [] };
          },
          first: async () => {
            if (sql.includes("FROM health_findings")) {
              const key = `${binds[1]}:${binds[2]}`;
              return findings.has(key) ? { id: key } : null;
            }
            return null;
          },
          run: async () => {
            if (sql.includes("INSERT INTO health_findings")) {
              findings.add(`${binds[3]}:${binds[4]}`);
            }
            if (sql.includes("INSERT INTO audit_events")) {
              auditRuns.push({ binds });
            }
            return { success: true };
          }
        })
      })
    }
  } as unknown as Env;
  return { env, findings, auditRuns };
}

function createPlaybookHealthTestEnv(markdown: string, assetCount = 0) {
  const findings = new Set<string>();
  const auditRuns: unknown[] = [];
  const env = {
    CONTENT_BUCKET: {
      get: async () => ({ text: async () => markdown })
    },
    DB: {
      prepare: (sql: string) => ({
        bind: (...binds: unknown[]) => ({
          all: async () => {
            if (sql.includes("FROM wiki_pages") && sql.includes("compiled_r2_key")) {
              return {
                results: [{
                  id: "wiki_playbook",
                  title: "Playbook Page",
                  slug: "playbook-page",
                  compiled_r2_key: "compiled/playbook.md",
                  asset_count: assetCount
                }]
              };
            }
            return { results: [] };
          },
          first: async () => {
            if (sql.includes("FROM health_findings")) {
              const key = `${binds[1]}:${binds[2]}`;
              return findings.has(key) ? { id: key } : null;
            }
            return null;
          },
          run: async () => {
            if (sql.includes("INSERT INTO health_findings")) {
              findings.add(`${binds[3]}:${binds[4]}`);
            }
            if (sql.includes("INSERT INTO audit_events")) {
              auditRuns.push({ binds });
            }
            return { success: true };
          }
        })
      })
    }
  } as unknown as Env;
  return { env, findings, auditRuns };
}

describe("runHealthChecks", () => {
  it("creates findings once and reports only newly inserted findings", async () => {
    const { env, findings, auditRuns } = createHealthTestEnv();

    const firstRun = await runHealthChecks(env);
    const secondRun = await runHealthChecks(env);

    expect(firstRun).toBe(5);
    expect(secondRun).toBe(0);
    expect(findings.size).toBe(5);
    expect(auditRuns).toHaveLength(2);
  });

  it("flags published pages missing implementation playbook sections and downloads", async () => {
    const { env, findings } = createPlaybookHealthTestEnv("# Playbook Page\n\n## Strategy Overview\n\nEducational notes only.");

    const created = await runHealthChecks(env);

    expect(created).toBe(2);
    expect(findings.has("missing_download_asset:Missing download asset: Playbook Page")).toBe(true);
    expect(findings.has("implementation_playbook_gap:Implementation playbook gap: Playbook Page")).toBe(true);
  });

  it("accepts a published page with implementation sections and a download", async () => {
    const markdown = `# Complete Page

## Best Fit
## When This Is Not A Fit
## Implementation Steps
## Documentation File
## Operating Rhythm
## Stop Before You Act If
## Common Mistakes
## Team Handoff
## Completion Checklist
## Related Downloads
## Before You Act
`;
    const { env } = createPlaybookHealthTestEnv(markdown, 1);

    await expect(runHealthChecks(env)).resolves.toBe(0);
  });
});
