
import handler from "../../dist/seo-worker.js";

interface NetlifyContext {
  next(request?: Request): Promise<Response>;
}

const readEnv = (key: string): string | undefined => {
  try {
    return Deno.env.get(key);
  } catch {
    return undefined;
  }
};

export default async (
  request: Request,
  context: NetlifyContext
): Promise<Response> => {
  const env = {
    ASSETS: {
      fetch: (assetRequest: Request) => context.next(assetRequest),
    },
    SITE_URL: readEnv("SITE_URL"),
    GOOGLE_SITE_VERIFICATION: readEnv("GOOGLE_SITE_VERIFICATION"),
    GOOGLE_VERIFICATION_FILE: readEnv("GOOGLE_VERIFICATION_FILE"),
    BING_SITE_VERIFICATION: readEnv("BING_SITE_VERIFICATION"),
    CANONICAL_REDIRECT: readEnv("CANONICAL_REDIRECT"),
  };

  return handler.fetch(request, env);
};

export const config = { path: "/*" };
