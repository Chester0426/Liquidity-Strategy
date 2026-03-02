import { track } from "./analytics";

export function trackVisitLanding(props?: {
  referrer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  gclid?: string;
  click_id?: string;
  utm_content?: string;
}) {
  track("visit_landing", props);
}

export function trackSignupStart(props: { method: string }) {
  track("signup_start", props);
}

export function trackSignupComplete(props: { method: string }) {
  track("signup_complete", props);
}

export function trackActivate(props: { action: string }) {
  track("activate", props);
}

export function trackRetainReturn(props: { days_since_last: number }) {
  track("retain_return", props);
}
