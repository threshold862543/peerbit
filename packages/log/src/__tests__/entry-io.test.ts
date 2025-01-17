import { EntryIO } from "../entry-io.js";
import { Log } from "../log.js";
import assert from "assert";
import rmrf from "rimraf";
import fs from "fs-extra";
import { Keystore, KeyWithMeta } from "@dao-xyz/peerbit-keystore";
import { Ed25519Keypair } from "@dao-xyz/peerbit-crypto";
import { dirname } from "path";
import { fileURLToPath } from "url";
import path from "path";
import {
	BlockStore,
	MemoryLevelBlockStore,
} from "@dao-xyz/libp2p-direct-block";
import { signingKeysFixturesPath, testKeyStorePath } from "./utils.js";
import { createStore } from "./utils.js";

const __filename = fileURLToPath(import.meta.url);
const __filenameBase = path.parse(__filename).base;
const __dirname = dirname(__filename);

let store: BlockStore,
	signKey: KeyWithMeta<Ed25519Keypair>,
	signKey2: KeyWithMeta<Ed25519Keypair>,
	signKey3: KeyWithMeta<Ed25519Keypair>,
	signKey4: KeyWithMeta<Ed25519Keypair>;

const last = (arr: any[]) => arr[arr.length - 1];

describe("Entry - Persistency", function () {
	let options, keystore: Keystore;

	beforeAll(async () => {
		rmrf.sync(testKeyStorePath(__filenameBase));
		await fs.copy(
			signingKeysFixturesPath(__dirname),
			testKeyStorePath(__filenameBase)
		);

		keystore = new Keystore(
			await createStore(testKeyStorePath(__filenameBase))
		);

		const users = ["userA", "userB", "userC", "userD"];
		options = users.map((user) => {
			return Object.assign(
				{},
				{
					id: user,
					keystore,
				}
			);
		});
		await keystore.waitForOpen();
		signKey = (await keystore.getKey(
			new Uint8Array([0])
		)) as KeyWithMeta<Ed25519Keypair>;
		signKey2 = (await keystore.getKey(
			new Uint8Array([1])
		)) as KeyWithMeta<Ed25519Keypair>;
		signKey3 = (await keystore.getKey(
			new Uint8Array([2])
		)) as KeyWithMeta<Ed25519Keypair>;
		signKey4 = (await keystore.getKey(
			new Uint8Array([3])
		)) as KeyWithMeta<Ed25519Keypair>;

		store = new MemoryLevelBlockStore();
		await store.open();
	});

	afterAll(async () => {
		await store.close();
		rmrf.sync(testKeyStorePath(__filenameBase));
		await keystore?.close();
	});

	it("log with one entry", async () => {
		const log = new Log(
			store,
			{
				...signKey.keypair,
				sign: async (data: Uint8Array) => await signKey.keypair.sign(data),
			},
			{ logId: "X" }
		);
		await log.append("one");
		const hash = log.toArray()[0].hash;
		const res = await EntryIO.fetchAll(store, hash, { length: 1 });
		expect(res.length).toEqual(1);
	});

	it("log with 2 entries", async () => {
		const log = new Log(
			store,
			{
				...signKey.keypair,
				sign: async (data: Uint8Array) => await signKey.keypair.sign(data),
			},
			{ logId: "X" }
		);
		await log.append("one");
		await log.append("two");
		const hash = last(log.toArray()).hash;
		const res = await EntryIO.fetchAll(store, hash, { length: 2 });
		expect(res.length).toEqual(2);
	});

	it("loads max 1 entry from a log of 2 entry", async () => {
		const log = new Log(
			store,
			{
				...signKey.keypair,
				sign: async (data: Uint8Array) => await signKey.keypair.sign(data),
			},
			{ logId: "X" }
		);
		await log.append("one");
		await log.append("two");
		const hash = last(log.toArray()).hash;
		const res = await EntryIO.fetchAll(store, hash, { length: 1 });
		expect(res.length).toEqual(1);
	});

	it("log with 100 entries", async () => {
		const count = 100;
		const log = new Log(
			store,
			{
				...signKey.keypair,
				sign: async (data: Uint8Array) => await signKey.keypair.sign(data),
			},
			{ logId: "X" }
		);
		for (let i = 0; i < count; i++) {
			await log.append("hello" + i);
		}
		const hash = await log.toMultihash();
		const result = await Log.fromMultihash(
			store,
			{
				...signKey.keypair,
				sign: async (data: Uint8Array) => await signKey.keypair.sign(data),
			},
			hash,
			{}
		);
		expect(result.length).toEqual(count);
	});

	it("load only 42 entries from a log with 100 entries", async () => {
		const count = 100;
		const log = new Log(
			store,
			{
				...signKey.keypair,
				sign: async (data: Uint8Array) => await signKey.keypair.sign(data),
			},
			{ logId: "X" }
		);
		let log2 = new Log(
			store,
			{
				...signKey.keypair,
				sign: async (data: Uint8Array) => await signKey.keypair.sign(data),
			},
			{ logId: "X" }
		);
		for (let i = 1; i <= count; i++) {
			await log.append("hello" + i);
			if (i % 10 === 0) {
				log2 = new Log(
					store,
					{
						...signKey.keypair,
						sign: async (data: Uint8Array) => await signKey.keypair.sign(data),
					},
					{
						logId: log2.id,
						entries: log2.toArray(),
						heads: log2.heads.concat(log.heads),
					}
				);
				await log2.append("hi" + i);
			}
		}

		const hash = await log.toMultihash();
		const result = await Log.fromMultihash(
			store,
			{
				...signKey.keypair,
				sign: async (data: Uint8Array) => await signKey.keypair.sign(data),
			},
			hash,
			{ length: 42 }
		);
		expect(result.length).toEqual(42);
	});

	it("load only 99 entries from a log with 100 entries", async () => {
		const count = 100;
		const log = new Log(
			store,
			{
				...signKey.keypair,
				sign: async (data: Uint8Array) => await signKey.keypair.sign(data),
			},
			{ logId: "X" }
		);
		let log2 = new Log(
			store,
			{
				...signKey.keypair,
				sign: async (data: Uint8Array) => await signKey.keypair.sign(data),
			},
			{ logId: "X" }
		);
		for (let i = 1; i <= count; i++) {
			await log.append("hello" + i);
			if (i % 10 === 0) {
				log2 = new Log(
					store,
					{
						...signKey.keypair,
						sign: async (data: Uint8Array) => await signKey.keypair.sign(data),
					},
					{ logId: log2.id, entries: log2.toArray() }
				);
				await log2.append("hi" + i);
				await log2.join(log);
			}
		}

		const hash = await log2.toMultihash();
		const result = await Log.fromMultihash(
			store,
			{
				...signKey.keypair,
				sign: async (data: Uint8Array) => await signKey.keypair.sign(data),
			},
			hash,
			{ length: 99 }
		);
		expect(result.length).toEqual(99);
	});

	it("load only 10 entries from a log with 100 entries", async () => {
		const count = 100;
		const log = new Log(
			store,
			{
				...signKey.keypair,
				sign: async (data: Uint8Array) => await signKey.keypair.sign(data),
			},
			{ logId: "X" }
		);
		let log2 = new Log(
			store,
			{
				...signKey.keypair,
				sign: async (data: Uint8Array) => await signKey.keypair.sign(data),
			},
			{ logId: "X" }
		);
		let log3 = new Log(
			store,
			{
				...signKey.keypair,
				sign: async (data: Uint8Array) => await signKey.keypair.sign(data),
			},
			{ logId: "X" }
		);
		for (let i = 1; i <= count; i++) {
			await log.append("hello" + i);
			if (i % 10 === 0) {
				log2 = new Log(
					store,
					{
						...signKey.keypair,
						sign: async (data: Uint8Array) => await signKey.keypair.sign(data),
					},
					{
						logId: log2.id,
						entries: log2.toArray(),
						heads: log2.heads,
					}
				);
				await log2.append("hi" + i);
				await log2.join(log);
			}
			if (i % 25 === 0) {
				log3 = new Log(
					store,
					{
						...signKey.keypair,
						sign: async (data: Uint8Array) => await signKey.keypair.sign(data),
					},
					{
						logId: log3.id,
						entries: log3.toArray(),
						heads: log3.heads.concat(log2.heads),
					}
				);
				await log3.append("--" + i);
			}
		}

		await log3.join(log2);
		const hash = await log3.toMultihash();
		const result = await Log.fromMultihash(
			store,
			{
				...signKey.keypair,
				sign: async (data: Uint8Array) => await signKey.keypair.sign(data),
			},
			hash,
			{ length: 10 }
		);
		expect(result.length).toEqual(10);
	});

	it("load only 10 entries and then expand to max from a log with 100 entries", async () => {
		const count = 30;

		const log = new Log(
			store,
			{
				...signKey.keypair,
				sign: async (data: Uint8Array) => await signKey.keypair.sign(data),
			},
			{ logId: "X" }
		);
		const log2 = new Log(
			store,
			{
				...signKey2.keypair,
				sign: async (data: Uint8Array) => await signKey2.keypair.sign(data),
			},
			{ logId: "X" }
		);
		let log3 = new Log(
			store,
			{
				...signKey3.keypair,
				sign: async (data: Uint8Array) => await signKey3.keypair.sign(data),
			},
			{ logId: "X" }
		);
		for (let i = 1; i <= count; i++) {
			await log.append("hello" + i);
			if (i % 10 === 0) {
				await log2.append("hi" + i);
				await log2.join(log);
			}
			if (i % 25 === 0) {
				log3 = new Log(
					store,
					{
						...signKey3.keypair,
						sign: async (data: Uint8Array) => await signKey3.keypair.sign(data),
					},
					{
						logId: log3.id,
						entries: log3.toArray(),
						heads: log3.heads.concat(log2.heads),
					}
				);
				await log3.append("--" + i);
			}
		}

		await log3.join(log2);

		const log4 = new Log(
			store,
			{
				...signKey4.keypair,
				sign: async (data: Uint8Array) => await signKey4.keypair.sign(data),
			},
			{ logId: "X" }
		);
		await log4.join(log2);
		await log4.join(log3);

		const values3 = log3.toArray().map((e) => e.payload.getValue());
		const values4 = log4.toArray().map((e) => e.payload.getValue());

		assert.deepStrictEqual(values3, values4);
	});
});
