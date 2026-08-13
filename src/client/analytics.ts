import { sendGAEvent } from "@next/third-parties/google";

/**
 * Drop-in replacement for `nextjs-google-analytics`'s `event`, mapping its
 * category/label/value shape onto the GA4 params `@next/third-parties` sends.
 */
export function event(
  action: string,
  params: { category?: string; label?: string; value?: number },
) {
  sendGAEvent("event", action, {
    event_category: params.category,
    event_label: params.label,
    value: params.value,
  });
}
