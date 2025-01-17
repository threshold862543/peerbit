export * from "./errors.js";
import { field, fixedArray, variant } from "@dao-xyz/borsh";
import { compare } from "@dao-xyz/uint8arrays";
import sodium from "libsodium-wrappers";
import {
	Keypair,
	PrivateEncryptionKey,
	PublicKeyEncryptionKey,
} from "./key.js";
import {
	Ed25519Keypair,
	Ed25519PublicKey,
	Ed25519PrivateKey,
} from "./ed25519.js";
import { toHexString } from "./utils.js";

@variant(0)
export class X25519PublicKey extends PublicKeyEncryptionKey {
	@field({ type: fixedArray("u8", 32) })
	publicKey: Uint8Array;

	constructor(properties?: { publicKey: Uint8Array }) {
		super();
		if (properties) {
			this.publicKey = properties.publicKey;
		}
	}

	equals(other: PublicKeyEncryptionKey): boolean {
		if (other instanceof X25519PublicKey) {
			return compare(this.publicKey, other.publicKey) === 0;
		}
		return false;
	}
	toString(): string {
		return "x25519p/" + toHexString(this.publicKey);
	}

	static async from(
		ed25119PublicKey: Ed25519PublicKey
	): Promise<X25519PublicKey> {
		await sodium.ready;
		return new X25519PublicKey({
			publicKey: sodium.crypto_sign_ed25519_pk_to_curve25519(
				ed25119PublicKey.publicKey
			),
		});
	}

	static async create(): Promise<X25519PublicKey> {
		await sodium.ready;
		return new X25519PublicKey({
			publicKey: sodium.crypto_box_keypair().publicKey,
		});
	}
}

@variant(0)
export class X25519SecretKey extends PrivateEncryptionKey {
	@field({ type: fixedArray("u8", 32) })
	secretKey: Uint8Array;

	constructor(properties?: { secretKey: Uint8Array }) {
		super();
		if (properties) {
			this.secretKey = properties.secretKey;
		}
	}

	equals(other: PublicKeyEncryptionKey): boolean {
		if (other instanceof X25519SecretKey) {
			return (
				compare(this.secretKey, (other as X25519SecretKey).secretKey) === 0
			);
		}
		return false;
	}
	toString(): string {
		return "x25519s" + toHexString(this.secretKey);
	}

	async publicKey(): Promise<X25519PublicKey> {
		return new X25519PublicKey({
			publicKey: sodium.crypto_scalarmult_base(this.secretKey),
		});
	}
	static async from(
		ed25119SecretKey: Ed25519PrivateKey
	): Promise<X25519SecretKey> {
		await sodium.ready;
		return new X25519SecretKey({
			secretKey: sodium.crypto_sign_ed25519_sk_to_curve25519(
				ed25119SecretKey.privateKey
			),
		});
	}

	static async create(): Promise<X25519SecretKey> {
		await sodium.ready;
		return new X25519SecretKey({
			secretKey: sodium.crypto_box_keypair().privateKey,
		});
	}
}

@variant(1)
export class X25519Keypair extends Keypair {
	@field({ type: X25519PublicKey })
	publicKey: X25519PublicKey;

	@field({ type: X25519SecretKey })
	secretKey: X25519SecretKey;

	static async create(): Promise<X25519Keypair> {
		await sodium.ready;
		const generated = sodium.crypto_box_keypair();
		const kp = new X25519Keypair();
		kp.publicKey = new X25519PublicKey({
			publicKey: generated.publicKey,
		});
		kp.secretKey = new X25519SecretKey({
			secretKey: generated.privateKey,
		});
		return kp;
	}

	static async from(ed25119Keypair: Ed25519Keypair): Promise<X25519Keypair> {
		const pk = await X25519PublicKey.from(ed25119Keypair.publicKey);
		const sk = await X25519SecretKey.from(ed25119Keypair.privateKey);
		const kp = new X25519Keypair();
		kp.publicKey = pk;
		kp.secretKey = sk;
		return kp;
	}

	equals(other: Keypair) {
		if (other instanceof X25519Keypair) {
			return (
				this.publicKey.equals(other.publicKey) &&
				this.secretKey.equals(
					(other as X25519Keypair).secretKey as X25519SecretKey as any
				)
			);
		}
		return false;
	}
}
