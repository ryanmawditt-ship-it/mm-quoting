import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";
import { upsertUser, getUserByOpenId } from "./db";

/**
 * Password-based authentication.
 * Users enter a shared site password to access the app.
 * On success, a JWT session cookie is issued for a "site-user" account.
 */

const SITE_USER_OPEN_ID = "site-user-password-auth";
const SITE_USER_NAME = "MM Albion";

async function ensureSiteUser() {
  let user = await getUserByOpenId(SITE_USER_OPEN_ID);
  if (!user) {
    await upsertUser({
      openId: SITE_USER_OPEN_ID,
      name: SITE_USER_NAME,
      email: null,
      loginMethod: "password",
      role: "admin",
      lastSignedIn: new Date(),
    });
    user = await getUserByOpenId(SITE_USER_OPEN_ID);
  }
  return user;
}

export function registerPasswordAuthRoutes(app: Express) {
  // POST /api/auth/password-login
  app.post("/api/auth/password-login", async (req: Request, res: Response) => {
    try {
      const { password } = req.body;

      if (!password || typeof password !== "string") {
        res.status(400).json({ error: "Password is required" });
        return;
      }

      const sitePassword = ENV.sitePassword;
      if (!sitePassword) {
        console.error("[PasswordAuth] SITE_PASSWORD not configured");
        res.status(500).json({ error: "Site password not configured" });
        return;
      }

      if (password !== sitePassword) {
        res.status(401).json({ error: "Incorrect password" });
        return;
      }

      // Password correct — ensure site user exists and issue session
      const user = await ensureSiteUser();
      if (!user) {
        res.status(500).json({ error: "Failed to create site user" });
        return;
      }

      // Update last signed in
      await upsertUser({
        openId: SITE_USER_OPEN_ID,
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(SITE_USER_OPEN_ID, {
        name: SITE_USER_NAME,
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.json({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      });
    } catch (error) {
      console.error("[PasswordAuth] Login failed:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  // GET /api/auth/check — check if the user has a valid session
  app.get("/api/auth/check", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      res.json({ authenticated: true, user: { id: user.id, name: user.name, role: user.role } });
    } catch {
      res.json({ authenticated: false });
    }
  });
}
