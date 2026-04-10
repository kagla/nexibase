/**
 * GA4 visitor stats response shape (shared between API route and widget).
 */
export interface VisitorStatsData {
  online: number
  today: number
  yesterday: number
  sevenDays: number
  configured: boolean
}
