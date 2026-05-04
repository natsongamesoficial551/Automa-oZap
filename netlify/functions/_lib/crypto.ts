import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";

function keyFromString(secret: string) {
  return createHash("sha256").update(secret).digest();
}

export function encryptSecret(value: string, encryptionKey: string) {
  const iv = randomBytes(12);
  const key = keyFromString(encryptionKey);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptSecret(payload: string, encryptionKey: string) {
  const [ivHex, tagHex, dataHex] = payload.split(":");
  const key = keyFromString(encryptionKey);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]);
  return decrypted.toString("utf8");
}

export function verifyMetaSignature(rawBody: string, signature: string | undefined, appSecret: string) {
  if (!signature?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  return signature === `sha256=${expected}`;
}
