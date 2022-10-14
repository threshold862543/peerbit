import { variant, field, option, serialize, vec } from '@dao-xyz/borsh';
import { ProtocolMessage } from './message.js';
import { U8IntArraySerializer } from '@dao-xyz/borsh-utils';
import { Ed25519Keypair, Ed25519PublicKey, IPFSAddress, K, PublicKeyEncryptionResolver, X25519Keypair, X25519PublicKey } from '@dao-xyz/peerbit-crypto'
import { Keystore, KeyWithMeta } from '@dao-xyz/orbit-db-keystore';
import { MaybeSigned, SignatureWithKey } from '@dao-xyz/peerbit-crypto';
import { DecryptedThing } from "@dao-xyz/peerbit-crypto";
import { TimeoutError, waitForAsync } from '@dao-xyz/time';
import { Key, PublicSignKey } from '@dao-xyz/peerbit-crypto';
// @ts-ignore
import Logger from 'logplease'
import { Identity } from '@dao-xyz/ipfs-log';
import { TrustedNetwork } from '@dao-xyz/peerbit-trusted-network';
import { PeersResult } from 'ipfs-core-types/dist/src/swarm/index.js';
const logger = Logger.create('exchange-network', { color: Logger.Colors.Yellow })
Logger.setLogLevel('ERROR')

@variant(0)
export class PeerInfo {

    @field({ type: 'string' })
    id: string;

    @field({ type: 'string' })
    address: string;

    constructor(props?: { id: string, address: string }) {
        if (props) {
            this.id = props.id;
            this.address = props.address;
        }
    }
}
@variant([3, 0])
export class ExchangeSwarmMessage extends ProtocolMessage {

    @field({ type: vec(PeerInfo) })
    info: PeerInfo[];

    // TODO peer info for sending repsonse directly
    constructor(props?: { info: PeerInfo[] }) {
        super();
        if (props) {
            this.info = props.info;
        }
    }
}

export const exchangeSwarmAddresses = async (
    send: (data: Uint8Array) => Promise<void>,
    identity: Identity,
    peerReciever: string,
    peers: PeersResult[],
    network?: TrustedNetwork,
    localNetwork?: boolean
) => {
    let trustedAddresses: PeersResult[];
    if (network) {
        const isTrusted = (peer: PeersResult) => network.isTrusted(new IPFSAddress({ address: peer.peer.toString() }));
        trustedAddresses = await Promise.all(peers.map(isTrusted))
            .then((results) => peers.filter((_v, index) => results[index]))
    }
    else {
        trustedAddresses = peers
    }
    const isLocalhostAddress = (addr: string) => addr.toString().includes('/127.0.0.1/')
    const filteredAddresses = trustedAddresses.filter(x => x.peer.toString() !== peerReciever && (localNetwork || !isLocalhostAddress(x.peer.toString()))).map(x => {
        return new PeerInfo({
            id: x.peer.toString(),
            address: x.addr.toString()
        })
    })
    if (filteredAddresses.length === 0) {
        return;
    }



    const message = serialize(new ExchangeSwarmMessage({
        info: filteredAddresses
    }))
    const signatureResult = await identity.sign(message);
    await send(serialize(await new DecryptedThing<ExchangeSwarmMessage>({
        data: serialize(new MaybeSigned({
            signature: new SignatureWithKey({
                signature: signatureResult,
                publicKey: identity.publicKey
            }),
            data: message
        }))
    })));

}