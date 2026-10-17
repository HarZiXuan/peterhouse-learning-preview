// Application-level encryption: AES-256-GCM with a random nonce per value.
//
// * Keys come from DATA_ENCRYPTION_KEYS, never from the database. The first key encrypts; every key can decrypt,
//   so a key can be rotated by adding a new one in front and re-encrypting at leisure.
// * Each purpose (text fields, photo files) uses its own key derived with HKDF.
// * Text fields are bound to their column with GCM "additional data", so a value copied into another column
//   fails to decrypt instead of being read as something else.
import crypto from "node:crypto";
import { config } from "./config";

type Keyring = { current: string; keys: Map<string, Buffer> };

function parseKeyring(spec: string): Keyring {
  const keys = new Map<string, Buffer>();
  let current = "";
  for (const part of spec.split(",").map((s) => s.trim()).filter(Boolean)) {
    const i = part.indexOf(":");
    if (i < 1) throw new Error("DATA_ENCRYPTION_KEYS must look like id:base64key[,id2:base64key2]");
    const id = part.slice(0, i);
    const raw = Buffer.from(part.slice(i + 1), "base64");
    if (raw.length !== 32) throw new Error(`Encryption key "${id}" must be 32 bytes (44 base64 characters).`);
    keys.set(id, raw);
    if (!current) current = id;
  }
  if (!current) throw new Error("DATA_ENCRYPTION_KEYS is empty.");
  return { current, keys };
}

const ring = parseKeyring(config.encryptionKeys);
const derived = new Map<string, Buffer>();

function subKey(keyId: string, purpose: "fields" | "files"): Buffer {
  const cacheKey = `${keyId}/${purpose}`;
  let k = derived.get(cacheKey);
  if (!k) {
    const master = ring.keys.get(keyId);
    if (!master) throw new Error(`Data was encrypted with key "${keyId}", which is not in DATA_ENCRYPTION_KEYS.`);
    k = Buffer.from(crypto.hkdfSync("sha256", master, "peterhouse-learning-review", `v1/${purpose}`, 32));
    derived.set(cacheKey, k);
  }
  return k;
}

const PREFIX = "enc:v1:";

/** Encrypts a text value. `where` names the column ("children.preferred_name") and is authenticated with the data. */
export function encryptText(plain: string, where: string): string {
  const keyId = ring.current;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", subKey(keyId, "fields"), iv);
  cipher.setAAD(Buffer.from(where));
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `${PREFIX}${keyId}:${Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64")}`;
}

export function decryptText(stored: string, where: string): string {
  if (!stored.startsWith(PREFIX)) throw new Error(`${where} is not encrypted. Refusing to read unencrypted data.`);
  const rest = stored.slice(PREFIX.length);
  const i = rest.indexOf(":");
  const keyId = rest.slice(0, i);
  const raw = Buffer.from(rest.slice(i + 1), "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", subKey(keyId, "fields"), raw.subarray(0, 12));
  decipher.setAAD(Buffer.from(where));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
}

export const encryptJson = (value: unknown, where: string) => encryptText(JSON.stringify(value), where);
export const decryptJson = <T>(stored: string, where: string): T => JSON.parse(decryptText(stored, where)) as T;

const FILE_MAGIC = Buffer.from("PHE1");

/** Encrypts a whole file (a photo). Layout: magic, key id length, key id, nonce, tag, ciphertext. */
export function encryptBytes(plain: Buffer): Buffer {
  const keyId = Buffer.from(ring.current);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", subKey(ring.current, "files"), iv);
  const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([FILE_MAGIC, Buffer.from([keyId.length]), keyId, iv, cipher.getAuthTag(), ct]);
}

export function decryptBytes(blob: Buffer): Buffer {
  if (!blob.subarray(0, 4).equals(FILE_MAGIC)) throw new Error("This file is not encrypted. Refusing to read it.");
  const idLen = blob[4];
  const keyId = blob.subarray(5, 5 + idLen).toString();
  let o = 5 + idLen;
  const iv = blob.subarray(o, o + 12);
  const tag = blob.subarray(o + 12, o + 28);
  o += 28;
  const decipher = crypto.createDecipheriv("aes-256-gcm", subKey(keyId, "files"), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(blob.subarray(o)), decipher.final()]);
}
