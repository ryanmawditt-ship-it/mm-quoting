import { describe, it, expect } from "vitest";

describe("Site Password", () => {
  it("SITE_PASSWORD env variable is set", () => {
    expect(process.env.SITE_PASSWORD).toBeDefined();
    expect(process.env.SITE_PASSWORD).not.toBe("");
  });

  it("SITE_PASSWORD matches expected value", () => {
    expect(process.env.SITE_PASSWORD).toBe("880");
  });
});
