import { describe, it, expect, beforeAll } from "vitest";
import { createHmac } from "node:crypto";

const SECRET = "test-secret-at-least-sixteen-chars-long";

// The module reads SESSION_SIGNING_SECRET lazily, inside signingSecret(), so
// setting it before the dynamic import is enough — no module mocking needed.
process.env.SESSION_SIGNING_SECRET = SECRET;

let verifyTokenSignature: (token: string) => string | null;
let sessionCookieOptions: (expiresAt: Date) => Record<string, unknown>;

beforeAll(async () => {
  const mod = await import("./session");
  verifyTokenSignature = mod.verifyTokenSignature;
  sessionCookieOptions = mod.sessionCookieOptions as typeof sessionCookieOptions;
});

/** Build a token the way issueSession does: "<sessionId>.<hmac>". */
function makeToken(sessionId: string, secret = SECRET): string {
  const mac = createHmac("sha256", secret).update(sessionId).digest("hex");
  return `${sessionId}.${mac}`;
}

describe("verifyTokenSignature", () => {
  const sessionId = "7f3a1c22-0000-4000-8000-abcdefabcdef";

  it("accepts a token it signed and returns the session id", () => {
    expect(verifyTokenSignature(makeToken(sessionId))).toBe(sessionId);
  });

  it("rejects a token signed with a different secret", () => {
    expect(verifyTokenSignature(makeToken(sessionId, "some-other-secret-value"))).toBeNull();
  });

  it("rejects a token whose session id was swapped", () => {
    const token = makeToken(sessionId);
    const [, mac] = token.split(".");
    expect(verifyTokenSignature(`11111111-0000-4000-8000-abcdefabcdef.${mac}`)).toBeNull();
  });

  it("rejects a single flipped character in the signature", () => {
    const token = makeToken(sessionId);
    const [id, mac] = token.split(".");
    const flipped = (mac[0] === "a" ? "b" : "a") + mac.slice(1);
    expect(verifyTokenSignature(`${id}.${flipped}`)).toBeNull();
  });

  it("rejects a truncated signature", () => {
    const token = makeToken(sessionId);
    const [id, mac] = token.split(".");
    expect(verifyTokenSignature(`${id}.${mac.slice(0, -2)}`)).toBeNull();
  });

  it("rejects malformed tokens without throwing", () => {
    for (const bad of ["", ".", "no-dot", `${sessionId}.`, `.${"a".repeat(64)}`, `${sessionId}.abc.def`]) {
      expect(() => verifyTokenSignature(bad)).not.toThrow();
      expect(verifyTokenSignature(bad)).toBeNull();
    }
  });

  it("rejects a non-hex signature without throwing", () => {
    // Buffer.from(str, "hex") silently drops invalid bytes, so a length check
    // alone is not enough to keep timingSafeEqual from throwing.
    expect(() => verifyTokenSignature(`${sessionId}.${"z".repeat(64)}`)).not.toThrow();
    expect(verifyTokenSignature(`${sessionId}.${"z".repeat(64)}`)).toBeNull();
  });

  it("does not treat the session id as a signature", () => {
    expect(verifyTokenSignature(`${sessionId}.${sessionId}`)).toBeNull();
  });
});

describe("sessionCookieOptions", () => {
  it("is httpOnly and same-site so script and cross-site requests cannot read or send it", () => {
    const opts = sessionCookieOptions(new Date(Date.now() + 60_000));
    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe("lax");
    expect(opts.path).toBe("/");
  });

  it("carries the expiry it was given", () => {
    const expiresAt = new Date(Date.now() + 3_600_000);
    expect(sessionCookieOptions(expiresAt).expires).toEqual(expiresAt);
  });
});
