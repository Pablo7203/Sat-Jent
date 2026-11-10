/** Public routes are enabled in this commerce copy unless an environment opts out. */
export function isPublicWebsiteEnabled(
  value = process.env.PUBLIC_WEBSITE_ENABLED,
) {
  return value !== "false";
}
