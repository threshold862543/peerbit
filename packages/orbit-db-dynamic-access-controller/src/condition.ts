import { field, variant } from "@dao-xyz/borsh";
import { Entry } from '@dao-xyz/ipfs-log-entry';
import { U8IntArraySerializer, arraysEqual } from '@dao-xyz/io-utils';

@variant(0)
export class Network {

    @field({ type: 'String' })
    type: string;

    @field({ type: 'String' })
    rpc: string;
}

export class AccessCondition<T> {

    async allowed(entry: Entry<T>): Promise<boolean> {
        throw new Error("Not implemented")
    }
}

@variant([0, 0])
export class AnyAccessCondition<T> extends AccessCondition<T> {
    constructor() {
        super();
    }
    async allowed(entry: Entry<T>): Promise<boolean> {
        return true;
    }
}

@variant([0, 1])
export class PublicKeyAccessCondition<T> extends AccessCondition<T> {

    @field({ type: 'String' })
    type: string

    @field(U8IntArraySerializer)
    key: Uint8Array

    constructor(options?: {
        type: string,
        key: Uint8Array
    }) {
        super();
        if (options) {
            this.type = options.type;
            this.key = options.key
        }
    }

    async allowed(entry: Entry<T>): Promise<boolean> {
        return this.type === entry.data.identity.type && arraysEqual(this.key, entry.data.identity.id)
    }
}

/*  Not yet :)

@variant([0, 2])
export class TokenAccessCondition extends AccessCondition {

    @field({ type: Network })
    network: Network

    @field({ type: 'String' })
    token: string

    @field({ type: 'u64' })
    amount: BN

    constructor() {
        super();
    }
}


@variant(0)
export class NFTPropertyCondition {
    @field({ type: 'String' })
    field: string

    @field({ type: 'String' })
    value: string;
}

 @variant([0, 3])  // distinguish between ERC-721, ERC-1155, Solana Metaplex? 
export class NFTAccessCondition extends AccessCondition {

    @field({ type: Network })
    network: Network

    @field({ type: 'String' })
    name: string

    @field({ type: option(vec(NFTPropertyCondition)) })
    properties: NFTPropertyCondition

    constructor() {
        super();
    }
}
 */
