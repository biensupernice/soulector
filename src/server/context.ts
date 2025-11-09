import * as trpc from "@trpc/server";
import * as trpcNext from "@trpc/server/adapters/next";
import { createDbConnection } from "./db";

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface CreateContextOptions {
  // session: Session | null
  isAuthenticated?: boolean;
}

/**
 * Inner function for `createContext` where we create the context.
 * This is useful for testing when we don't want to mock Next.js' request/response
 */
export async function createContextInner(_opts: CreateContextOptions) {
  const db = await createDbConnection();
  return {
    db,
    isAuthenticated: _opts.isAuthenticated || false,
  };
}

export type Context = trpc.inferAsyncReturnType<typeof createContextInner>;

/**
 * Basic auth validation
 */
function validateBasicAuth(authHeader: string): boolean {
  if (!authHeader.startsWith("Basic ")) {
    return false;
  }

  const credentials = Buffer.from(authHeader.slice(6), "base64").toString(
    "utf8",
  );
  const [username, password] = credentials.split(":");

  const expectedUsername = process.env.INTERNAL_AUTH_USERNAME;
  const expectedPassword = process.env.INTERNAL_AUTH_PASSWORD;

  if (!expectedUsername || !expectedPassword) {
    console.warn(
      "INTERNAL_AUTH_USERNAME or INTERNAL_AUTH_PASSWORD not set in environment variables",
    );
    return false;
  }

  return username === expectedUsername && password === expectedPassword;
}

/**
 * Creates context for an incoming request
 * @link https://trpc.io/docs/context
 */
export async function createContext(
  opts: trpcNext.CreateNextContextOptions,
): Promise<Context> {
  // for API-response caching see https://trpc.io/docs/caching

  const authHeader = opts.req.headers.authorization;
  const isAuthenticated = authHeader ? validateBasicAuth(authHeader) : false;

  const ctx = await createContextInner({ isAuthenticated });
  return ctx;
}
