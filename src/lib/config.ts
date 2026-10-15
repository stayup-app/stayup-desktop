/** The one StayUp API this app talks to. */
export const API_URL: string =
  (import.meta.env.VITE_STAYUP_API_URL as string | undefined)?.replace(/\/$/, "") ??
  "https://stayup-api.r-sik.workers.dev"
