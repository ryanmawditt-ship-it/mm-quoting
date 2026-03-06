import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock the ENV module before importing anything else
vi.mock("./_core/env", () => ({
  ENV: {
    sitePassword: "test-password-123",
    appId: "",
    cookieSecret: "test-secret",
    databaseUrl: "",
    oAuthServerUrl: "",
    ownerOpenId: "",
    isProduction: false,
    forgeApiUrl: "",
    forgeApiKey: "",
  },
}));

// Mock the SDK
vi.mock("./_core/sdk", () => ({
  sdk: {
    createSessionToken: vi.fn().mockResolvedValue("mock-session-token"),
    authenticateRequest: vi.fn(),
  },
}));

// Mock the DB functions
vi.mock("./db", () => ({
  getUserByOpenId: vi.fn().mockResolvedValue({
    id: 1,
    openId: "site-user-password-auth",
    name: "MM Albion",
    email: null,
    role: "admin",
    loginMethod: "password",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  }),
  upsertUser: vi.fn().mockResolvedValue(undefined),
}));

import express from "express";
import { registerPasswordAuthRoutes } from "./passwordAuth";

function createTestApp() {
  const app = express();
  app.use(express.json());
  registerPasswordAuthRoutes(app);
  return app;
}

describe("Password Authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects empty password", async () => {
    const app = createTestApp();

    const response = await fetch(
      await startTestServer(app, "/api/auth/password-login"),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }
    );

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("Password is required");
  });

  it("rejects incorrect password", async () => {
    const app = createTestApp();

    const response = await fetch(
      await startTestServer(app, "/api/auth/password-login"),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "wrong-password" }),
      }
    );

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe("Incorrect password");
  });

  it("accepts correct password and returns success", async () => {
    const app = createTestApp();

    const response = await fetch(
      await startTestServer(app, "/api/auth/password-login"),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "test-password-123" }),
      }
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.user).toBeDefined();
    expect(data.user.name).toBe("MM Albion");
    expect(data.user.role).toBe("admin");

    // Check that a session cookie was set
    const setCookie = response.headers.get("set-cookie");
    expect(setCookie).toBeTruthy();
    expect(setCookie).toContain("app_session_id");
  });
});

// Helper to start a test server on a random port
async function startTestServer(app: express.Express, path: string): Promise<string> {
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const addr = server.address();
      if (addr && typeof addr === "object") {
        resolve(`http://localhost:${addr.port}${path}`);
      }
      // Auto-close after 5 seconds
      setTimeout(() => server.close(), 5000);
    });
  });
}
