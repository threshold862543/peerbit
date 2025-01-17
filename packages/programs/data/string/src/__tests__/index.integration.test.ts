import { DString } from "../string-store.js";
import {
	StringQueryRequest,
	StringResult,
	StringMatchQuery,
	RangeMetadatas,
	RangeMetadata,
} from "../index.js";
import { Range } from "../range.js";
import {
	createStore,
	LSession,
	waitForPeers,
} from "@dao-xyz/peerbit-test-utils";
import Cache from "@dao-xyz/lazy-level";
import { Identity } from "@dao-xyz/peerbit-log";
import { Ed25519Keypair, X25519PublicKey } from "@dao-xyz/peerbit-crypto";
import { DefaultOptions } from "@dao-xyz/peerbit-store";
import { delay, waitFor } from "@dao-xyz/peerbit-time";
import { Libp2pExtended } from "@dao-xyz/peerbit-libp2p";
import { ObserverType, ReplicatorType } from "@dao-xyz/peerbit-program";

const createIdentity = async () => {
	const ed = await Ed25519Keypair.create();
	return {
		publicKey: ed.publicKey,
		sign: (data) => ed.sign(data),
	} as Identity;
};

describe("query", () => {
	let session: LSession,
		observer: Libp2pExtended,
		writer: Libp2pExtended,
		writeStore: DString,
		observerStore: DString;

	beforeAll(async () => {
		session = await LSession.connected(2);
		observer = session.peers[0];
		writer = session.peers[1];
	});

	beforeEach(async () => {
		// Create store
		writeStore = new DString({});
		await writeStore.init(writer, await createIdentity(), {
			role: new ReplicatorType(),
			store: {
				...DefaultOptions,
				encryption: {
					getAnyKeypair: (_) => Promise.resolve(undefined),
					getEncryptionKeypair: () => Ed25519Keypair.create(),
				},
				resolveCache: () => new Cache(createStore()),
			},
		});

		observerStore = (await DString.load(
			writer.directblock,
			writeStore.address!
		)) as DString;

		await observerStore.init(observer, await createIdentity(), {
			role: new ObserverType(),
			store: {
				...DefaultOptions,
				resolveCache: () => new Cache(createStore()),
			},
		});

		await waitForPeers(
			session.peers[0],
			[session.peers[1]],
			writeStore.query.rpcTopic
		);
	});
	afterEach(async () => {
		await writeStore.close();
		await observerStore.close();
	});

	afterAll(async () => {
		await session.stop();
	});

	it("match all", async () => {
		await writeStore.add(
			"hello",
			new Range({ offset: 0n, length: "hello".length })
		);
		await writeStore.add(
			"world",
			new Range({
				offset: BigInt("hello ".length),
				length: "world".length,
			})
		);

		let response: StringResult = undefined as any;

		await observerStore.query.send(
			new StringQueryRequest({
				queries: [],
			}),
			(r) => {
				response = r;
			},
			{ amount: 1 }
		);
		expect(response).toBeDefined();
		expect(response).toMatchObject(
			new StringResult({
				string: "hello world",
				metadatas: undefined, //  because we are matching without any specific query
			})
		);
	});

	it("match part", async () => {
		await writeStore.add(
			"hello",
			new Range({ offset: 0n, length: "hello".length })
		);
		await writeStore.add(
			"world",
			new Range({
				offset: BigInt("hello ".length),
				length: "world".length,
			})
		);

		let response: StringResult = undefined as any;

		await observerStore.query.send(
			new StringQueryRequest({
				queries: [
					new StringMatchQuery({
						exactMatch: true,
						value: "o w",
					}),
					new StringMatchQuery({
						exactMatch: true,
						value: "orld",
					}),
				],
			}),
			(r) => {
				response = r;
			},
			{ amount: 1 }
		);
		expect(response).toBeDefined();
		expect(response).toMatchObject(
			new StringResult({
				string: "hello world",
				metadatas: new RangeMetadatas({
					metadatas: [
						new RangeMetadata({
							length: BigInt("o w".length),
							offset: BigInt("hell".length),
						}),
						new RangeMetadata({
							length: BigInt("orld".length),
							offset: BigInt("hello w".length),
						}),
					],
				}),
			})
		);
	});

	it("toString remote", async () => {
		await writeStore.add(
			"hello",
			new Range({ offset: 0n, length: "hello".length })
		);
		await writeStore.add(
			"world",
			new Range({
				offset: BigInt("hello ".length),
				length: "world".length,
			})
		);

		let callbackValues: string[] = [];
		const string = await observerStore.toString({
			remote: {
				callback: (s) => callbackValues.push(s),
				queryOptions: { amount: 1 },
			},
		});
		expect(string).toEqual("hello world");
		expect(callbackValues).toEqual(["hello world"]);
	});

	it("handles AccessError gracefully", async () => {
		const store = new DString({});
		await store.init(writer, await createIdentity(), {
			role: new ReplicatorType(),
			store: {
				...DefaultOptions,
				encryption: {
					getAnyKeypair: (_) => Promise.resolve(undefined),
					getEncryptionKeypair: () => Ed25519Keypair.create(),
				},
				resolveCache: () => new Cache(createStore()),
			},
		});

		await store.add(
			"hello",
			new Range({ offset: 0n, length: "hello".length }),
			{
				reciever: {
					metadata: undefined,
					signatures: undefined,
					next: undefined,
					payload: [await X25519PublicKey.create()],
				},
			}
		);
		await store.close();
		await delay(1000); // TODO store is async?
		await store.load();
		await waitFor(() => store.store.oplog.values.length === 1);
		await store.close();
	});
});
