import { PostHog } from "posthog-node";

const PROJECT_NAME = "liquidity-strategy";
const PROJECT_OWNER = "Chester";
const POSTHOG_KEY = "phc_9pSomMlHylLB9GXolTGMZ9jZJnITRwNaJacJLkKA8rY";
const POSTHOG_HOST = "https://us.i.posthog.com";

export async function trackServerEvent(
  event: string,
  distinctId: string,
  properties?: Record<string, unknown>
) {
  const client = new PostHog(POSTHOG_KEY, {
    host: POSTHOG_HOST,
  });

  client.capture({
    distinctId,
    event,
    properties: {
      ...properties,
      project_name: PROJECT_NAME,
      project_owner: PROJECT_OWNER,
    },
  });

  await client.shutdown();
}
