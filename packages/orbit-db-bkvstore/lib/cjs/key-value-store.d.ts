/// <reference types="orbit-db" />
import { Constructor } from '@dao-xyz/borsh';
import Store from 'orbit-db-store';
import { KeyValueIndex } from './key-value-index';
export declare const BINARY_KEYVALUE_STORE_TYPE = "bkvstore";
export declare class BinaryKeyValueStore<T> extends Store<T, KeyValueIndex<T>> {
    _type: string;
    constructor(ipfs: any, id: any, dbname: any, options: IStoreOptions & {
        clazz: Constructor<T>;
    });
    get(key: string): T;
    set(key: string, data: T, options?: {}): Promise<string>;
    put(key: string, data: T, options?: {}): Promise<string>;
    del(key: string, options?: {}): Promise<string>;
}
