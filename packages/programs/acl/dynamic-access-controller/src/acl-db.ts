import { field, variant } from '@dao-xyz/borsh';
import { DDocuments, Operation } from '@dao-xyz/peerbit-ddoc';
import { getPathGenerator, TrustedNetwork, getFromByTo, RelationContract } from '@dao-xyz/peerbit-trusted-network';
import { Access, AccessData, AccessType } from './access';
import { Entry, Identity, Payload } from '@dao-xyz/ipfs-log'
import { MaybeEncrypted, PublicSignKey, SignatureWithKey, SignKey } from '@dao-xyz/peerbit-crypto';

// @ts-ignore
import { v4 as uuid } from 'uuid';
import { DSearch } from '@dao-xyz/peerbit-dsearch';
import { Program } from '@dao-xyz/peerbit-program';
import { DQuery } from '@dao-xyz/peerbit-dquery';

@variant([0, 12])
export class DynamicAccessController extends Program {

    @field({ type: DDocuments })
    access: DDocuments<AccessData>;

    @field({ type: RelationContract })
    identityGraphController: RelationContract;

    @field({ type: TrustedNetwork })
    trustedNetwork: TrustedNetwork

    constructor(opts?: {
        name?: string;
        rootTrust?: PublicSignKey,
        trustedNetwork?: TrustedNetwork
    }) {
        super(opts);
        if (opts) {
            if (!opts.trustedNetwork && !opts.rootTrust) {
                throw new Error("Expecting either TrustedNetwork or rootTrust")
            }
            this.access = new DDocuments({
                indexBy: 'id',
                search: new DSearch({
                    query: new DQuery({})
                })
            })

            this.trustedNetwork = opts.trustedNetwork ? opts.trustedNetwork : new TrustedNetwork({
                name: (opts.name || uuid()) + "_region",
                rootTrust: opts.rootTrust as PublicSignKey
            })
            this.identityGraphController = new RelationContract({ name: 'relation', });
        }
    }



    // allow anyone write to the ACL db, but assume entry is invalid until a verifier verifies
    // can append will be anyone who has peformed some proof of work

    // or 

    // custom can append

    async canRead(s: SignKey | undefined): Promise<boolean> {
        // TODO, improve, caching etc

        if (!s) {
            return false;
        }


        // Check whether it is trusted by trust web
        if (await this.trustedNetwork.isTrusted(s)) {
            return true;
        }

        // Else check whether its trusted by this access controller
        const canReadCheck = async (key: PublicSignKey) => {
            for (const value of Object.values(this.access._index._index)) {
                const access = value.value;
                if (access instanceof Access) {
                    if (access.accessTypes.find((x) => x === AccessType.Any || x === AccessType.Read) !== undefined) {
                        // check condition
                        if (await access.accessCondition.allowed(key)) {
                            return true;
                        }
                        continue;
                    }
                }
            }
        }

        if (await canReadCheck(s)) {
            return true;
        }
        for await (const trustedByKey of getPathGenerator(s, this.identityGraphController.relationGraph, getFromByTo)) {
            if (await canReadCheck(trustedByKey.from)) {
                return true;
            }
        }



        return false;
    }

    async canAppend(entry: Entry<any>): Promise<boolean> {
        // TODO, improve, caching etc


        // Check whether it is trusted by trust web
        const key = await entry.getPublicKey();
        if (await this.trustedNetwork.isTrusted(key)) {
            return true;
        }
        // Else check whether its trusted by this access controller
        const canWriteCheck = async (key: PublicSignKey) => {
            for (const value of Object.values(this.access._index._index)) {
                const access = value.value
                if (access instanceof Access) {
                    if (access.accessTypes.find((x) => x === AccessType.Any || x === AccessType.Write) !== undefined) {
                        // check condition
                        if (await access.accessCondition.allowed(key)) {
                            return true;
                        }
                        continue;
                    }
                }

            }
        }
        if (await canWriteCheck(key)) {
            return true;
        }
        for await (const trustedByKey of getPathGenerator(key, this.identityGraphController.relationGraph, getFromByTo)) {
            if (await canWriteCheck(trustedByKey.from)) {
                return true;
            }
        }

        return false;
    }

    async setup() {
        await this.identityGraphController.setup({ canRead: this.canRead.bind(this) })
        await this.access.setup({ type: AccessData, canAppend: this.canAppend.bind(this), canRead: this.canRead.bind(this) })
        await this.trustedNetwork.setup();
    }
}