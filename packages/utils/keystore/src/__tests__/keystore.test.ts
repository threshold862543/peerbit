import path from "path";
import assert from "assert";
import { Keystore, KeyWithMeta } from "../keystore";
import rmrf from "rimraf";
import { AbstractLevel } from "abstract-level";
import {
	Ed25519Keypair,
	X25519Keypair,
	X25519PublicKey,
} from "@dao-xyz/peerbit-crypto";
import { jest } from "@jest/globals";
import fs from "fs-extra";
import { StoreError } from "../errors.js";
import { dirname } from "path";
import { fileURLToPath } from "url";

// @ts-ignore
import { v4 as uuid } from "uuid";
import { fixturePath } from "./fixture.js";
import { createStore } from "./utils";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const storagePath = path.join(__dirname, "signing-keys");
const tempKeyPath = path.join(__dirname, "keystore-test");

jest.setTimeout(600000);

describe("keystore", () => {
	beforeAll(async () => {
		await fs.copy(fixturePath, storagePath);
		rmrf.sync(tempKeyPath);
	});

	afterAll(async () => {
		rmrf.sync(storagePath);
		rmrf.sync(tempKeyPath);
	});

	describe("constructor", () => {
		let store: AbstractLevel<any, string, Uint8Array>;

		beforeAll(async () => {
			store = store || (await createStore(tempKeyPath + "/1")); // storagePath
		});

		it("creates a new Keystore instance", async () => {
			const keystore = new Keystore(store);

			expect(typeof keystore.close).toEqual("function");
			expect(typeof keystore.openStore).toEqual("function");
			expect(typeof keystore.hasKey).toEqual("function");
			expect(typeof keystore.createKey).toEqual("function");
			expect(typeof keystore.getKey).toEqual("function");
		});

		it("assigns this._store", async () => {
			const keystore = new Keystore(store);
			// Loose check for leveldownishness
			assert(["open", "opening"].includes(keystore._store.status));
		});

		it("assigns this.cache with default of 100", async () => {
			const keystore = new Keystore(store);
			expect(keystore._cache.max).toEqual(100);
		});

		it("creates a keystore with empty options", async () => {
			let store = await createStore();
			const keystore = new Keystore(store);
			expect(keystore._store.status).toEqual("opening");
		});

		it("creates a keystore with both", async () => {
			let store = await createStore();
			const keystore = new Keystore(store);
			assert(["open", "opening"].includes(keystore._store.status));
			expect(keystore._cache).toBeDefined();
			expect(keystore._store === store);
		});
	});

	describe("createKey", () => {
		let keystore: Keystore;
		let store: AbstractLevel<any, string, Uint8Array>;

		beforeAll(async () => {
			store = store || (await createStore(tempKeyPath + "/2")); // storagePath
			keystore = new Keystore(store);
		});

		it("creates a new key ed25519 without group ", async () => {
			const id = new Uint8Array([1, 2, 4]);
			const key = await keystore.createEd25519Key({ id });
			expect(await keystore.hasKey(id)).toBeTrue();
			expect(await keystore.getKey(id)).toBeDefined();
			expect(await keystore.hasKey(key.keypair.publicKey)).toBeTrue();

			// Also its conversion
			expect(
				await keystore.hasKey(await X25519PublicKey.from(key.keypair.publicKey))
			).toBeTrue();
			expect(
				await keystore.getKey(await X25519PublicKey.from(key.keypair.publicKey))
			).toBeDefined();
		});
		it("creates a new key ed25519 in group", async () => {
			const id = new Uint8Array([6, 5, 4]);
			const group = "group";
			const key = await keystore.createEd25519Key({ id, group });
			expect(await keystore.hasKey(id, group)).toBeTrue();
			expect(await keystore.getKey(id, group)).toBeDefined();
			expect(await keystore.hasKey(key.keypair.publicKey)).toBeTrue();

			// Also its conversion
			expect(
				await keystore.hasKey(await X25519PublicKey.from(key.keypair.publicKey))
			).toBeTrue();
			expect(
				await keystore.getKey(await X25519PublicKey.from(key.keypair.publicKey))
			).toBeDefined();
		});

		it("creates id from key", async () => {
			const key = await keystore.createEd25519Key();
			expect(await keystore.getKey(key.keypair.publicKey)).toBeDefined();
			expect(await keystore.hasKey(key.keypair.publicKey)).toBeTrue();
		});

		it("throws an error if key already exist", async () => {
			const id = "already";
			await keystore.createEd25519Key({ id });
			try {
				await keystore.createEd25519Key({ id });
				fail();
			} catch (e: any) {}
		});
		it("throws an error accessing a closed store", async () => {
			const closedKeysStore = new Keystore({ status: "closed" } as any);
			try {
				const id = "X";
				await closedKeysStore.createEd25519Key({ id });
			} catch (e: any) {
				expect(e).toBeInstanceOf(StoreError);
				expect((e as StoreError).message).toEqual(
					"Keystore is closed or closing"
				);
			}
		});

		afterEach(async () => {
			// await keystore.close()
		});
	});

	it("throws an error if key already exist", async () => {
		const id = "already";
		const keystore = new Keystore(await createStore(tempKeyPath + "/unique"));
		await keystore.createEd25519Key({ id });
		try {
			await keystore.createEd25519Key({ id });
		} catch (e: any) {
			assert(true);
		}
	});

	afterEach(async () => {
		// await keystore.close()
	});
});

describe("hasKey", () => {
	let keystore: Keystore;
	let store: AbstractLevel<any, string, Uint8Array>;

	beforeAll(async () => {
		store = store || (await createStore(tempKeyPath + "/3")); // storagePath

		keystore = new Keystore(store);
		await keystore.waitForOpen();
		await keystore.createEd25519Key({ id: "YYZ" });
	});

	it("returns true if key exists", async () => {
		const hasKey = await keystore.hasKey("YYZ");
		expect(hasKey).toEqual(true);
	});

	it("returns false if key does not exist", async () => {
		let hasKey = await keystore.hasKey("XXX");
		let getKey = await keystore.getKey("XXX");
		expect(getKey).toBeUndefined();
		expect(hasKey).toEqual(false);
	});
	afterEach(async () => {
		// await keystore.close()
	});
});

describe("getKey", () => {
	let store: AbstractLevel<any, string, Uint8Array>;
	let keystore: Keystore,
		createdKey: KeyWithMeta<Ed25519Keypair>,
		createdKeyInGroup: KeyWithMeta<Ed25519Keypair>;
	beforeAll(async () => {
		store = store || (await createStore(tempKeyPath + "/4")); // storagePath
		keystore = new Keystore(store);
		createdKey = await keystore.createEd25519Key({
			id: "ZZZ",
			overwrite: true,
		});
		createdKeyInGroup = await keystore.createEd25519Key({
			id: "YYY",
			group: "group",
			overwrite: true,
		});
	});

	afterAll(async () => {
		await keystore.close();
	});
	it("gets an existing key", async () => {
		const key = await keystore.getKey("ZZZ");
		expect(key?.keypair).toBeDefined();
	});

	it("gets an existing key in group", async () => {
		const key = await keystore.getKey("YYY", "group");
		expect(key?.keypair).toBeDefined();
	});

	it("gets key in group by publickey", async () => {
		const key = await keystore.getKey(createdKeyInGroup.keypair.publicKey);
		expect(key?.keypair).toBeDefined();
	});

	it("throws an error upon accessing a non-existant key", async () => {
		try {
			await keystore.getKey("ZZZZ");
		} catch (e: any) {
			assert(true);
		}
	});

	it("throws an error accessing a closed store", async () => {
		const closedKeysStore = new Keystore({ status: "closed" } as any);
		try {
			await closedKeysStore.getKey("ZZZ");
		} catch (e: any) {
			expect(e).toBeInstanceOf(StoreError);
			expect((e as StoreError).message).toEqual(
				"Keystore is closed or closing"
			);
		}
	});
});

describe("getKeys", () => {
	let keystore: Keystore,
		aSignKey: KeyWithMeta<Ed25519Keypair>,
		aBoxKey: KeyWithMeta<X25519Keypair>,
		aBox2Key: KeyWithMeta<X25519Keypair>,
		bSignKey: KeyWithMeta<Ed25519Keypair>;
	let store: AbstractLevel<any, string, Uint8Array>;

	beforeAll(async () => {
		store = store || (await createStore(tempKeyPath + "/5")); // storagePath
	});

	it("gets keys by group", async () => {
		keystore = new Keystore(store);
		const group = uuid();
		const group2 = uuid();
		aSignKey = await keystore.createEd25519Key({
			id: "asign",
			group,
			overwrite: true,
		});
		aBoxKey = await keystore.createX25519Key({
			id: "abox",
			group,
			overwrite: true,
		});
		aBox2Key = await keystore.createX25519Key({
			id: "abox2",
			group,
			overwrite: true,
		});
		bSignKey = await keystore.createEd25519Key({
			id: "bsign",
			group: group2,
			overwrite: true,
		});

		const keysByGroup = await keystore.getKeys(group);
		expect(keysByGroup).toHaveLength(4); // because aSignKey with be also saved as X25519key
		expect(
			await Promise.all(
				keysByGroup!.map((k) =>
					(k.keypair as X25519Keypair | Ed25519Keypair).publicKey.hashcode()
				)
			)
		).toContainAllValues(
			await Promise.all(
				[aBoxKey, aBox2Key, aSignKey, await KeyWithMeta.toX25519(aSignKey)].map(
					(k) =>
						(k.keypair as X25519Keypair | Ed25519Keypair).publicKey.hashcode()
				)
			)
		);
		const keysByType = await keystore.getKeys(group2);
		expect(
			await Promise.all(
				keysByType!.map((k) =>
					(k.keypair as X25519Keypair | Ed25519Keypair).publicKey.hashcode()
				)
			)
		).toContainAllValues(
			await Promise.all(
				[bSignKey, await KeyWithMeta.toX25519(bSignKey)].map((k) =>
					(k.keypair as X25519Keypair | Ed25519Keypair).publicKey.hashcode()
				)
			)
		);
	});
});
