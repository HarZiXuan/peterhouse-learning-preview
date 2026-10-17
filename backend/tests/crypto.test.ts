import crypto from "node:crypto";
import { describe, expect, it, vi } from "vitest";

const key = () => crypto.randomBytes(32).toString("base64");

async function load(keys: string) {
  vi.resetModules();
  process.env.DATA_ENCRYPTION_KEYS = keys;
  return import("../src/crypto");
}

describe("field encryption", () => {
  it("round-trips text, including Chinese and emoji", async () => {
    const c = await load(`k1:${key()}`);
    for (const s of ["Mia", "陈小明 🌟", "", "line\nbreak"]) {
      const sealed = c.encryptText(s, "children.preferred_name");
      expect(sealed.startsWith("enc:v1:k1:")).toBe(true);
      expect(sealed).not.toContain(s || "\u0000");
      expect(c.decryptText(sealed, "children.preferred_name")).toBe(s);
    }
  });

  it("uses a fresh nonce every time", async () => {
    const c = await load(`k1:${key()}`);
    expect(c.encryptText("same", "x.y")).not.toBe(c.encryptText("same", "x.y"));
  });

  it("refuses a value moved into another column", async () => {
    const c = await load(`k1:${key()}`);
    const sealed = c.encryptText("secret", "children.preferred_name");
    expect(() => c.decryptText(sealed, "children.legal_name")).toThrow();
  });

  it("detects tampering", async () => {
    const c = await load(`k1:${key()}`);
    const sealed = c.encryptText("secret", "a.b");
    const raw = Buffer.from(sealed.split(":")[3], "base64");
    raw[raw.length - 1] ^= 1;
    expect(() => c.decryptText(`enc:v1:k1:${raw.toString("base64")}`, "a.b")).toThrow();
  });

  it("refuses to read plaintext", async () => {
    const c = await load(`k1:${key()}`);
    expect(() => c.decryptText("Mia", "children.preferred_name")).toThrow(/not encrypted/);
  });

  it("can rotate keys: new data uses the new key, old data still reads", async () => {
    const k1 = key();
    const k2 = key();
    const old = await load(`k1:${k1}`);
    const sealedOld = old.encryptText("before rotation", "a.b");
    const rotated = await load(`k2:${k2},k1:${k1}`);
    expect(rotated.encryptText("after", "a.b").startsWith("enc:v1:k2:")).toBe(true);
    expect(rotated.decryptText(sealedOld, "a.b")).toBe("before rotation");
    const lost = await load(`k2:${k2}`);
    expect(() => lost.decryptText(sealedOld, "a.b")).toThrow(/not in DATA_ENCRYPTION_KEYS/);
  });

  it("rejects a key of the wrong length", async () => {
    await expect(load("k1:c2hvcnQ=")).rejects.toThrow(/32 bytes/);
  });
});

describe("file encryption", () => {
  it("round-trips bytes and hides the content", async () => {
    const c = await load(`k1:${key()}`);
    const photo = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), crypto.randomBytes(500)]);
    const sealed = c.encryptBytes(photo);
    expect(sealed.includes(photo.subarray(0, 40))).toBe(false);
    expect(c.decryptBytes(sealed).equals(photo)).toBe(true);
  });

  it("detects a changed file", async () => {
    const c = await load(`k1:${key()}`);
    const sealed = c.encryptBytes(Buffer.from("photo bytes"));
    sealed[sealed.length - 1] ^= 1;
    expect(() => c.decryptBytes(sealed)).toThrow();
  });
});

describe("passwords", () => {
  it("verifies the right password only", async () => {
    const { hashPassword, verifyPassword, passwordProblem } = await import("../src/passwords");
    const h = await hashPassword("correct horse battery");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("correct horse battery", h)).toBe(true);
    expect(await verifyPassword("wrong horse battery", h)).toBe(false);
    expect(passwordProblem("short")).toBeTruthy();
    expect(passwordProblem("aaaaaaaaaaaa")).toBeTruthy();
    expect(passwordProblem("a decent passphrase")).toBeNull();
  });
});
