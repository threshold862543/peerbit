import { Log } from "@dao-xyz/ipfs-log";
import { Entry } from "@dao-xyz/ipfs-log-entry";
import { JSON_ENCODER } from "@dao-xyz/orbit-db-store";
import { Store } from "@dao-xyz/orbit-db-store"
import { OrbitDB } from "../../../orbit-db";
import { EncryptionTemplateMaybeEncrypted } from '@dao-xyz/ipfs-log-entry';

// TODO: generalize the Iterator functions and spin to its own module
export const EVENT_STORE_TYPE = 'event';
export interface Operation<T> {
    op: string
    key: string
    value: T
}
export class EventIndex<T> {
    _index: Log<T>;
    constructor() {
        this._index = null
    }

    get() {
        return this._index ? this._index.values : []
    }

    async updateIndex(oplog, entries?: []) {
        this._index = oplog
    }
}

export class EventStore<T> extends Store<Operation<T>, T, EventIndex<Operation<T>>, any> {
    constructor(ipfs, id, dbname, options: any = {}) {
        if (options.Index === undefined) Object.assign(options, { Index: EventIndex })
        if (options.encoding === undefined) Object.assign(options, { encoding: JSON_ENCODER })
        super(ipfs, id, dbname, options)
        this._type = EVENT_STORE_TYPE;
        /*  this.events.on("log.op.ADD", (address, hash, payload) => {
             this.events.emit("db.append", payload.value)
         }) */
    }

    add(data, options?: {
        onProgressCallback?: (any: any) => void;
        pin?: boolean;
        reciever?: EncryptionTemplateMaybeEncrypted
    }) {
        return this._addOperation({
            op: 'ADD',
            key: null,
            value: data
        }, options)
    }

    get(hash) {
        return this.iterator({ gte: hash, limit: 1 }).collect()[0]
    }

    iterator(options?) {
        const messages = this._query(options)
        let currentIndex = 0
        let iterator = {
            [Symbol.iterator]() {
                return this
            },
            next() {
                let item: { value?: Entry<Operation<T>>, done: boolean } = { value: null, done: true }
                if (currentIndex < messages.length) {
                    item = { value: messages[currentIndex], done: false }
                    currentIndex++
                }
                return item
            },
            collect: () => messages
        }

        return iterator
    }

    _query(opts) {
        if (!opts) opts = {}

        const amount = opts.limit ? (opts.limit > -1 ? opts.limit : this._index.get().length) : 1 // Return 1 if no limit is provided
        const events = this._index.get().slice()
        let result: Entry<Operation<T>>[] = []

        if (opts.gt || opts.gte) {
            // Greater than case
            result = this._read(events, opts.gt ? opts.gt : opts.gte, amount, !!opts.gte)
        } else {
            // Lower than and lastN case, search latest first by reversing the sequence
            result = this._read(events.reverse(), opts.lt ? opts.lt : opts.lte, amount, opts.lte || !opts.lt).reverse()
        }

        if (opts.reverse) {
            result.reverse()
        }

        return result
    }

    _read(ops: Entry<Operation<T>>[], hash, amount, inclusive) {
        // Find the index of the gt/lt hash, or start from the beginning of the array if not found
        const index = ops.map((e) => e.hash).indexOf(hash)
        let startIndex = Math.max(index, 0)
        // If gte/lte is set, we include the given hash, if not, start from the next element
        startIndex += inclusive ? 0 : 1
        // Slice the array to its requested size
        const res = ops.slice(startIndex).slice(0, amount)
        return res
    }
}
OrbitDB.addDatabaseType(EVENT_STORE_TYPE, EventStore)