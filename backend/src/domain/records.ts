// Reading and writing encrypted columns in one place, so no query has to remember which columns hold ciphertext.
import { decryptJson, decryptText, encryptJson, encryptText } from "../crypto";

/** Empty strings are stored as-is (they are column defaults); everything else is ciphertext. */
export const sealText = (plain: string, where: string): string => encryptText(plain, where);
export const openText = (stored: string, where: string): string => (stored === "" ? "" : decryptText(stored, where));

export const sealJson = (value: unknown, where: string): string => encryptJson(value, where);
export const openJson = <T>(stored: string, where: string): T => decryptJson<T>(stored, where);
export const openJsonOrNull = <T>(stored: string | null, where: string): T | null => (stored ? decryptJson<T>(stored, where) : null);
