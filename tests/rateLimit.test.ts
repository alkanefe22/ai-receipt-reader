import { beforeEach, describe, expect, it } from "vitest";
import { __resetMemoryRateLimit, clientKey, rateLimit } from "@/lib/rateLimit";

describe("rateLimit (in-memory)", () => {
  beforeEach(() => __resetMemoryRateLimit());
  const opts = { max: 2, windowSeconds: 60 };

  it("allows up to max requests per window, then blocks", async () => {
    const t = 1_000_000;
    expect((await rateLimit("ip", opts, t)).ok).toBe(true);
    expect((await rateLimit("ip", opts, t)).remaining).toBe(0);
    const blocked = await rateLimit("ip", opts, t);
    expect(blocked.ok).toBe(false);
    expect(blocked.resetAt).toBe(t + 60_000);
  });

  it("resets after the window", async () => {
    const t = 1_000_000;
    for (let i = 0; i < 3; i++) await rateLimit("ip", opts, t);
    expect((await rateLimit("ip", opts, t + 60_001)).ok).toBe(true);
  });

  it("tracks keys independently", async () => {
    for (let i = 0; i < 3; i++) await rateLimit("a", opts);
    expect((await rateLimit("b", opts)).ok).toBe(true);
  });
});

describe("clientKey", () => {
  it("uses the first forwarded address", () => {
    expect(clientKey(new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe("1.2.3.4");
    expect(clientKey(new Headers())).toBe("anonymous");
  });
});
