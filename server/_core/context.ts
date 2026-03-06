import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

/**
 * Default site user used when no authentication is configured.
 * This allows the app to work without any login flow.
 */
const DEFAULT_SITE_USER: User = {
  id: 1,
  openId: "site-user",
  name: "MM Albion",
  email: null,
  loginMethod: "none",
  role: "admin",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  // Try to get user from session cookie first
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch {
    // No valid session — fall back to default site user
    user = null;
  }

  // If no authenticated user, use the default site user so all procedures work
  if (!user) {
    user = DEFAULT_SITE_USER;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
