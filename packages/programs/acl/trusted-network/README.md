# Trusted network
A store that lets you build trusted networks of identities
The store is defined by the "root trust" which have the responsibility in the beginning to trust additional identities. Later, these identities can add more identities to the network. 
Trusted identities can also be revoked.

Distributing content among untrusted peers will be unreliable and not resilient to malicious parties that starts to participate in the replication process with large amount (>> min replicas) of nodes and shutting them down simultaneously (no way for the original peers recover all lost data). To mitigate this you can launch your program in a "Network", which is basically a list of nodes that trust each other. Symbolically you could thing of this as a VPC.

To do this, you only have to implement the "Network" interface: 
```typescript
import { Peerbit, Network } from '@dao-xyz/peerbit'
import { Store } from '@dao-xyz/peerbit-store'
import { Program } from '@dao-xyz/peerbit-program' 
import { TrustedNetwork } from '@dao-xyz/peerbit-trusted-network' 
import { field, variant } from '@dao-xyz/borst-ts' 

@variant("string_store") 
@network({property: 'network'})
class StringStore extends Program
{
    @field({type: Store})
    store: Store<string>

    @field({type: TrustedNetwork}) 
    network: TrustedNetwork // this is a database storing all peers. Peers that are trusted can add new peers

    constructor(properties?:{ store: Store<any>, network: TrustedNetwork }) {
        if(properties)
        {
            this.store = properties.store
        }
    }

    async setup() 
    {
        await store.setup({ encoding: ... , canAppend: ..., canRead: ...})
        await trustedNetwork.setup()
    }
}


// Later 
const peer1 = await Peerbit.create(LIBP2P_CLIENT, {... options ...})
const peer2 = await Peerbit.create(LIBP2P_CLIENT_2, {... options ...})

const programPeer1 = await peer1.open(new StringStore({store: new Store(), network: new TrustedNetwork()}), {... options ...})

// add trust to another peer
await program.network.add(peer2.identity.publicKey) 


// peer2 also has to "join" the network, in practice this means that peer2 adds a record telling that its Peer ID trusts its libp2p Id
const programPeer2 = await peer2.open(programPeer1.address, {... options ...})
await peer2.join(programPeer2) // This might fail with "AccessError" if you do this too quickly after "open", because it has not yet recieved the full trust graph from peer1 yet
```

See [this test(s)](./src/__tests__/network.test.ts) for working examples
