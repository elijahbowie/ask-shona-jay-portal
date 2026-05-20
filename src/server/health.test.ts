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

describe("runHealthChecks", () => {
  it("creates findings once and reports only newly inserted findings", async () => {
    const { env, findings, auditRuns } = createHealthTestEnv();

    const firstRun = await runHealthChecks(env);
    const secondRun = await runHealthChecks(env);

    expect(firstRun).toBe(3);
    expect(secondRun).toBe(0);
    expect(findings.size).toBe(3);
    expect(auditRuns).toHaveLength(2);
  });
});
