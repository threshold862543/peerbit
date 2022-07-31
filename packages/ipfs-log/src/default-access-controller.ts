import { Identities } from "@dao-xyz/orbit-db-identity-provider";
import { Entry } from '@dao-xyz/ipfs-log-entry';

export interface AccessController<T> {
  canAppend(entry: Entry<T>, identityProvider: Identities): Promise<boolean> | boolean;
  encrypt?(data: Uint8Array): Uint8Array
  decrypt?(data: Uint8Array): Uint8Array
}

export class DefaultAccessController<T> implements AccessController<T> {
  async canAppend(entry: Entry<T>, identityProvider: Identities): Promise<boolean> {
    return true
  }

  encrypt(data: Uint8Array): Uint8Array {
    return data;
  }

  decrypt(data: Uint8Array): Uint8Array {
    return data;
  }


}
