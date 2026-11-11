/**
 * Resolves the app's public origin and builds callback URLs used by invitations and password recovery.
 */

const LOCAL_SITE_URL = "http://localhost:3000";

function parseAbsoluteHttpUrl(value: string, variableName: string): URL {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:")
      throw new Error();
    return url;
  } catch {
    throw new Error(
      `${variableName} must be a valid absolute HTTP or HTTPS URL; received ${JSON.stringify(value)}.`,
    );
  }
}

export function resolveSiteUrl({
  configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL,
  vercelUrl = process.env.VERCEL_URL,
}: {
  configuredSiteUrl?: string;
  vercelUrl?: string;
} = {}): URL {
  const configured = configuredSiteUrl?.trim();
  if (configured)
    return parseAbsoluteHttpUrl(configured, "NEXT_PUBLIC_SITE_URL");

  const vercel = vercelUrl?.trim();
  if (vercel) {
    const value = /^https?:\/\//i.test(vercel) ? vercel : `https://${vercel}`;
    return parseAbsoluteHttpUrl(value, "VERCEL_URL");
  }

  return new URL(LOCAL_SITE_URL);
}

export function publicSiteUrl(path = ""): string {
  return new URL(path, resolveSiteUrl()).toString();
}

export function passwordSetupCallbackUrl(
  options: Parameters<typeof resolveSiteUrl>[0] = {},
): string {
  return new URL(
    "/auth/callback?next=/reset-password",
    resolveSiteUrl(options),
  ).toString();
}

/**
 * Uses the request host only when it is the configured site or this Vercel
 * deployment. This keeps preview checkouts on their own return URL without
 * accepting an arbitrary callback host from a public request.
 */
export function publicSiteUrlForRequest(
  path: string,
  requestOrigin: string,
): string {
  let requestUrl: URL;
  try {
    requestUrl = new URL(requestOrigin);
  } catch {
    return new URL(path, resolveSiteUrl()).toString();
  }

  const configuredSite = resolveSiteUrl();
  if (requestUrl.origin === configuredSite.origin) {
    return new URL(path, configuredSite).toString();
  }

  const deployment = process.env.VERCEL_URL?.trim();
  if (deployment) {
    const deploymentUrl = parseAbsoluteHttpUrl(
      /^https?:\/\//i.test(deployment) ? deployment : "https://" + deployment,
      "VERCEL_URL",
    );
    if (
      requestUrl.hostname.toLowerCase() ===
        deploymentUrl.hostname.toLowerCase() &&
      requestUrl.protocol === "https:"
    ) {
      return new URL(path, requestUrl).toString();
    }
  }

  return new URL(path, configuredSite).toString();
}
