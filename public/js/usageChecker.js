// Uses Resend's preview usage API (resend@6.19.0-preview-usage.0, installed
// under the alias "resend-usage" so it doesn't collide with the "resend"
// dependency used everywhere else for actually sending mail).
//
// This endpoint isn't in Resend's public docs yet - it's an early preview.
// Loaded via a dynamic import inside a try/catch so that if the package is
// ever missing, fails to install, or the API shape changes, this just skips
// the usage line instead of taking down the rest of the notify run.

async function getResendUsageClient() {
  const { Resend } = await import("resend-usage");
  return new Resend(process.env.RESEND_API_KEY);
}

// "2026-07-29T00:00:00.000Z" -> "in 3h 12m" / "in 45m" / "any moment now"
function formatResetIn(resetsAtIso) {
  const resetsAt = new Date(resetsAtIso);
  const diffMs = resetsAt.getTime() - Date.now();

  if (Number.isNaN(diffMs)) return "at an unknown time";
  if (diffMs <= 0) return "any moment now";

  const totalMinutes = Math.round(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `in ${minutes}m`;
  if (minutes === 0) return `in ${hours}h`;
  return `in ${hours}h ${minutes}m`;
}

// Returns a short one-line summary of daily Resend email usage, e.g.
// "42/100 daily emails used (resets in 3h 12m)" - or null if the check
// can't be completed, so callers can just omit the line rather than fail.
export async function getDailyUsageSummary() {
  try {
    const resend = await getResendUsageClient();
    const { data, error } = await resend.usage.get();

    if (error || !data) {
      console.warn(`Resend usage check failed: ${error?.message || "no data returned"}`);
      return null;
    }

    const daily = data.emails?.daily;
    if (!daily) {
      console.warn("Resend usage response missing emails.daily");
      return null;
    }

    return `${daily.used}/${daily.limit} daily emails used (resets ${formatResetIn(daily.resets_at)})`;
  } catch (err) {
    console.warn(`Resend usage check errored: ${err.message}`);
    return null;
  }
}
