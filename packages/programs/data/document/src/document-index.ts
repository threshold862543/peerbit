import { Constructor, field, serialize, variant } from "@dao-xyz/borsh";
import { asString, Keyable } from "./utils.js";
import { BORSH_ENCODING, Encoding, Entry } from "@dao-xyz/peerbit-log";
import { equals } from "@dao-xyz/uint8arrays";
import { ComposableProgram } from "@dao-xyz/peerbit-program";
import {
	FieldBigIntCompareQuery,
	FieldByteMatchQuery,
	FieldStringMatchQuery,
	MemoryCompareQuery,
	DocumentQueryRequest,
	Query,
	ResultWithSource,
	StateFieldQuery,
	CreatedAtQuery,
	ModifiedAtQuery,
	compare,
	Context,
	FieldMissingQuery,
} from "./query.js";
import { PublicSignKey } from "@dao-xyz/peerbit-crypto";
import { CanRead, RPC, QueryContext, RPCOptions } from "@dao-xyz/peerbit-rpc";
import { Results } from "./query.js";
import { logger as loggerFn } from "@dao-xyz/peerbit-logger";
import { Store } from "@dao-xyz/peerbit-store";
const logger = loggerFn({ module: "document-index" });

@variant(0)
export class Operation<T> {}

export const encoding = BORSH_ENCODING(Operation);

@variant(0)
export class PutOperation<T> extends Operation<T> {
	@field({ type: "string" })
	key: string;

	@field({ type: Uint8Array })
	data: Uint8Array;

	_value?: T;

	constructor(props?: { key: string; data: Uint8Array; value?: T }) {
		super();
		if (props) {
			this.key = props.key;
			this.data = props.data;
			this._value = props.value;
		}
	}

	get value(): T | undefined {
		if (!this._value) {
			throw new Error("Value not decoded, invoke getValue(...) once");
		}
		return this._value;
	}

	getValue(encoding: Encoding<T>): T {
		if (this._value) {
			return this._value;
		}
		this._value = encoding.decoder(this.data);
		return this._value;
	}
}

/* @variant(1)
export class PutAllOperation<T> extends Operation<T> {
	@field({ type: vec(PutOperation) })
	docs: PutOperation<T>[];

	constructor(props?: { docs: PutOperation<T>[] }) {
		super();
		if (props) {
			this.docs = props.docs;
		}
	}
}
 */
@variant(2)
export class DeleteOperation extends Operation<any> {
	@field({ type: "string" })
	key: string;

	constructor(props?: { key: string }) {
		super();
		if (props) {
			this.key = props.key;
		}
	}
}

export interface IndexedValue<T> {
	key: string;
	value: T; // decrypted, decoded
	entry: Entry<Operation<T>>;
	context: Context;
	source: Uint8Array;
}

@variant("documents_index")
export class DocumentIndex<T> extends ComposableProgram {
	@field({ type: RPC })
	_query: RPC<DocumentQueryRequest, Results<T>>;

	@field({ type: "string" })
	indexBy: string;

	_sync: (result: Results<T>) => Promise<void>;
	_index: Map<string, IndexedValue<T>>;
	type: Constructor<T>;
	_store: Store<Operation<T>>;

	constructor(properties: {
		query?: RPC<DocumentQueryRequest, Results<T>>;
		indexBy: string;
	}) {
		super();
		this._query = properties.query || new RPC();
		this.indexBy = properties.indexBy;
	}

	async setup(properties: {
		type: Constructor<T>;
		store: Store<Operation<T>>;
		canRead: CanRead;
		sync: (result: Results<T>) => Promise<void>;
	}) {
		this._index = new Map();
		this._store = properties.store;
		this.type = properties.type;
		this._sync = properties.sync;
		await this._query.setup({
			context: this,
			canRead: properties.canRead,
			responseHandler: async (query, context) => {
				const results = await this.queryHandler(query, context);
				if (results.length > 0) {
					return new Results({
						results: results.map(
							(r) =>
								new ResultWithSource({
									source: serialize(r.value),
									context: r.context,
								})
						),
					});
				}
				return undefined;
			},
			responseType: Results,
			queryType: DocumentQueryRequest,
		});
	}

	public get(key: Keyable): IndexedValue<T> | undefined {
		const stringKey = asString(key);
		return this._index.get(stringKey);
	}

	get size(): number {
		return this._index.size;
	}

	_queryDocuments(
		filter: (doc: IndexedValue<T>) => boolean
	): IndexedValue<T>[] {
		// Whether we return the full operation data or just the db value
		const results: IndexedValue<T>[] = [];
		for (const value of this._index.values()) {
			if (filter(value)) {
				results.push(value);
			}
		}
		return results;
	}

	queryHandler(
		query: DocumentQueryRequest,
		context?: QueryContext // TODO needed?
	): Promise<IndexedValue<T>[]> {
		const queries: Query[] = query.queries;
		const results = this._queryDocuments((doc) =>
			queries?.length > 0
				? queries
						.map((f) => {
							if (f instanceof StateFieldQuery) {
								let fv: any = doc.value;
								for (let i = 0; i < f.key.length; i++) {
									fv = fv[f.key[i]];
								}

								if (f instanceof FieldStringMatchQuery) {
									if (typeof fv !== "string") {
										return false;
									}
									return fv.toLowerCase().indexOf(f.value.toLowerCase()) !== -1;
								} else if (f instanceof FieldByteMatchQuery) {
									if (fv instanceof Uint8Array === false) {
										return false;
									}
									return equals(fv, f.value);
								} else if (f instanceof FieldBigIntCompareQuery) {
									const value: bigint | number = fv;

									if (typeof value !== "bigint" && typeof value !== "number") {
										return false;
									}

									return compare(value, f.compare, f.value);
								} else if (f instanceof FieldMissingQuery) {
									return fv == null; // null or undefined
								}
							} else if (f instanceof MemoryCompareQuery) {
								const operation = doc.entry.payload.getValue(encoding);
								if (!operation) {
									throw new Error(
										"Unexpected, missing cached value for payload"
									);
								}
								if (operation instanceof PutOperation) {
									const bytes = operation.data;
									for (const compare of f.compares) {
										const offsetn = Number(compare.offset); // TODO type check

										for (let b = 0; b < compare.bytes.length; b++) {
											if (bytes[offsetn + b] !== compare.bytes[b]) {
												return false;
											}
										}
									}
								} else {
									// TODO add implementations for PutAll
									return false;
								}
								return true;
							} else if (f instanceof CreatedAtQuery) {
								for (const created of f.created) {
									if (
										!compare(
											doc.context.created,
											created.compare,
											created.value
										)
									) {
										return false;
									}
								}
								return true;
							} else if (f instanceof ModifiedAtQuery) {
								for (const modified of f.modified) {
									if (
										!compare(
											doc.context.modified,
											modified.compare,
											modified.value
										)
									) {
										return false;
									}
								}
								return true;
							}

							logger.info("Unsupported query type: " + f.constructor.name);
							return false;
						})
						.reduce((prev, current) => prev && current)
				: true
		);

		return Promise.resolve(results);
	}
	public query(
		queryRequest: DocumentQueryRequest,
		responseHandler: (response: Results<T>, from?: PublicSignKey) => void,
		options?: {
			remote?: false | (RPCOptions & { sync?: boolean });
			local?: boolean;
		}
	): Promise<void[]> {
		const promises: Promise<void>[] = [];
		const local = typeof options?.local == "boolean" ? options?.local : true;
		let remote: RPCOptions | undefined;
		if (typeof options?.remote === "boolean") {
			if (options?.remote) {
				remote = {};
			} else {
				remote = undefined;
			}
		} else {
			remote = options?.remote;
		}

		if (!local && !remote) {
			throw new Error(
				"Expecting either 'options.remote' or 'options.local' to be true"
			);
		}

		if (local) {
			promises.push(
				this.queryHandler(queryRequest, {
					address: this.address.toString(),
					from: this.identity.publicKey,
				}).then((results) => {
					if (results.length > 0) {
						responseHandler(
							new Results({
								results: results.map(
									(r) =>
										new ResultWithSource({
											context: r.context,
											value: r.value,
											source: r.source,
										})
								),
							})
						);
					}
				})
			);
		}
		if (remote) {
			const remoteHandler = async (
				response: Results<T>,
				from?: PublicSignKey
			) => {
				response.results.forEach((r) => r.init(this.type));
				if (typeof options?.remote !== "boolean" && options?.remote?.sync) {
					await this._sync(response);
				}
				responseHandler(response, from);
			};
			promises.push(this._query.send(queryRequest, remoteHandler, remote));
		}
		return Promise.all(promises);
	}
}
