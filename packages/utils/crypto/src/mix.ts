import { AbstractType, deserialize } from "@dao-xyz/borsh";
import { PublicSignKey } from "./key.js";
import { MaybeSigned } from "./signature.js";
import { GetAnyKeypair, MaybeEncrypted } from "./encryption.js";
import { AccessError } from "./errors.js";
export const decryptVerifyInto = async <T>(
	data: Uint8Array,
	clazz: AbstractType<T>,
	keyResolver: GetAnyKeypair,
	options: { isTrusted?: (key: MaybeSigned<any>) => Promise<boolean> } = {}
): Promise<{ result: T; from?: PublicSignKey }> => {
	const maybeEncrypted = deserialize<MaybeEncrypted<MaybeSigned<any>>>(
		data,
		MaybeEncrypted
	);
	const decrypted = await maybeEncrypted.decrypt(keyResolver);
	const maybeSigned = decrypted.getValue(MaybeSigned);
	if (!(await maybeSigned.verify())) {
		throw new AccessError();
	}

	if (options.isTrusted) {
		if (!(await options.isTrusted(maybeSigned))) {
			throw new AccessError();
		}
	}
	return {
		result: deserialize(maybeSigned.data, clazz),
		from: maybeSigned.signature?.publicKey,
	};
};
