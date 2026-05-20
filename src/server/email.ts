import { sendGhlLoginCode } from "./ghl";

export async function sendLoginCodeEmail(env: Env, input: { email: string; code: string; expiresAt: string }): Promise<void> {
  if (env.GHL_ENABLED === "true" && env.GHL_API_KEY && env.GHL_LOCATION_ID) {
    await sendGhlLoginCode(env, input);
    return;
  }
  if (env.ENVIRONMENT === "development") {
    return;
  }
  throw new Error("Production login requires GHL_API_KEY and GHL_LOCATION_ID secrets.");
}
