import { toBase64 } from "./utils";
import { SHA256 } from "@stablelib/sha256";
export const sha256Base64 = async (bytes: Uint8Array) =>
	toBase64(await sha256(bytes));
export const sha256Base64Sync = (bytes: Uint8Array) =>
	toBase64(new SHA256().update(bytes).digest());
export const sha256 = async (bytes: Uint8Array) =>
	new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", bytes));
export const sha256Sync = (bytes: Uint8Array) =>
	new SHA256().update(bytes).digest();
