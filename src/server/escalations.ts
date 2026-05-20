import { nowIso } from "./crypto";
import { run } from "./db";
import { sendGhlEscalation } from "./ghl";

export interface EscalationNotificationInput {
  escalationId: string;
  clientEmail: string;
  summary: string;
  portalUrl: string;
}

export interface EscalationNotificationResult {
  ghlTaskId: string | null;
  queuedForRetry: boolean;
}

export async function notifyGhlEscalation(env: Env, input: EscalationNotificationInput): Promise<EscalationNotificationResult> {
  try {
    const ghlTaskId = await sendGhlEscalation(env, {
      clientEmail: input.clientEmail,
      summary: input.summary,
      portalUrl: input.portalUrl
    });
    if (ghlTaskId) {
      await run(env, "UPDATE escalations SET ghl_task_id = ?, updated_at = ? WHERE id = ?", ghlTaskId, nowIso(), input.escalationId);
    }
    return { ghlTaskId, queuedForRetry: false };
  } catch {
    await env.GHL_RETRY_QUEUE?.send({
      escalationId: input.escalationId,
      clientEmail: input.clientEmail,
      summary: input.summary,
      portalUrl: input.portalUrl
    });
    return { ghlTaskId: null, queuedForRetry: true };
  }
}
