const assert = require('assert')
const rmrf = require('rimraf')
const fs = require('fs-extra')
import { Keystore, SignKeyWithMeta } from '@dao-xyz/orbit-db-keystore'
import { Log } from '../log'

// Test utils
const {
    config,
    testAPIs,
    startIpfs,
    stopIpfs
} = require('orbit-db-test-utils')

let ipfsd, ipfs, signKey: SignKeyWithMeta

Object.keys(testAPIs).forEach((IPFS) => {
    describe('Log - Nexts', function () {
        jest.setTimeout(config.timeout * 4)

        const { identityKeyFixtures, signingKeyFixtures, identityKeysPath, signingKeysPath } = config

        let keystore: Keystore, signingKeystore: Keystore

        beforeAll(async () => {
            rmrf.sync(identityKeysPath)
            rmrf.sync(signingKeysPath)
            await fs.copy(identityKeyFixtures(__dirname), identityKeysPath)
            await fs.copy(signingKeyFixtures(__dirname), signingKeysPath)

            keystore = new Keystore(identityKeysPath)
            signingKeystore = new Keystore(signingKeysPath)

            signKey = await keystore.createKey(new Uint8Array([0]), SignKeyWithMeta);
            ipfsd = await startIpfs(IPFS, config.defaultIpfsConfig)
            ipfs = ipfsd.api
        })

        afterAll(async () => {
            await stopIpfs(ipfsd)
            rmrf.sync(identityKeysPath)
            rmrf.sync(signingKeysPath)

            await keystore?.close()
            await signingKeystore?.close()
        })
        describe('Custom next', () => {
            it('will filter refs from next', async () => {
                const log1 = new Log(ipfs, signKey.publicKey, (data) => Keystore.sign(data, signKey), { logId: 'A' })
                const e0 = await log1.append("0", { refs: [] })
                await log1.append("1a", { refs: [e0.hash], nexts: [e0.hash] })
                assert.strict.equal(log1.values[0].next?.length, 0)
                assert.strict.equal(log1.values[0].refs?.length, 0)
                assert.strict.equal(log1.values[1].next?.length, 1)
                assert.strict.equal(log1.values[1].refs?.length, 0)
                assert.strict.equal(log1.heads.length, 1)
                await log1.append("1b", { refs: [e0.hash], nexts: [e0.hash] })
                assert.strict.equal(log1.values[0].next?.length, 0)
                assert.strict.equal(log1.values[0].refs?.length, 0)
                assert.strict.equal(log1.values[1].next?.length, 1)
                assert.strict.equal(log1.values[1].refs?.length, 0)
                assert.strict.equal(log1.values[2].next?.length, 1)
                assert.strict.equal(log1.values[2].next[0], e0.hash)
                assert.strict.equal(log1.values[2].refs?.length, 0)
                assert.strict.equal(log1.heads.length, 2) // 1a and 1b since nextsResolver is not including 1a (e0 has two branchs)
            })

            it('can get nexts by references', async () => {

                const log1 = new Log(ipfs, signKey.publicKey, (data) => Keystore.sign(data, signKey), { logId: 'A' })
                const e0 = await log1.append("0", { refs: [] })
                const e1 = await log1.append("1", { refs: [e0.hash], nexts: log1.getNextsFromRefs([e0.hash]) })
                const e2a = await log1.append("2a", { refs: [e0.hash], nexts: log1.getNextsFromRefs([e0.hash]) })
                const e2b = await log1.append("2b", { refs: [e0.hash], nexts: [e1.hash] })

                const fork = await log1.append("x", { refs: [], nexts: [] }) // independent entry, not related to the other entries that are chained

                expect(log1.values).toStrictEqual([e0, e1, e2a, e2b, fork]);
                assert.strict.equal(e0.next?.length, 0)
                assert.strict.equal(e0.refs?.length, 0)
                expect(e1.next).toContainAllValues([e0.hash])
                assert.strict.equal(e1.refs?.length, 0)
                expect(e2a.next).toContainAllValues([e1.hash])
                expect(e2a.refs).toContainAllValues([e0.hash])
                expect(e2b.next).toContainAllValues([e1.hash])
                expect(e2b.refs).toContainAllValues([e0.hash])
                expect(fork.refs).toBeEmpty();
                expect(fork.next).toBeEmpty();
                expect(log1.heads.map(h => h.hash)).toContainValues([e2a.hash, e2a.hash, fork.hash])
                expect([...log1._nextsIndexToHead[e0.hash]]).toEqual([e1.hash])

                // we will get next where there should be two applicable heads
                const nexts = log1.getNextsFromRefs([e0.hash]);
                const e3 = await log1.append("3", { refs: [e0.hash], nexts: nexts })
                expect(log1.values[5].next).toContainAllValues([e2a.hash, e2b.hash])
                expect(log1.values[5].refs).toContainAllValues([e0.hash])
                expect(log1.heads.map(h => h.hash)).toContainValues([e3.hash, fork.hash])
            })

            it('can fork explicitly', async () => {

                const log1 = new Log(ipfs, signKey.publicKey, (data) => Keystore.sign(data, signKey), { logId: 'A' })
                const e0 = await log1.append("0", { refs: [] })
                const e1 = await log1.append("1", { refs: [e0.hash], nexts: log1.getNextsFromRefs([e0.hash]) })

                const e2a = await log1.append("2a", { refs: [e0.hash], nexts: log1.getNextsFromRefs([e0.hash]) })
                assert.strict.equal(log1.values[0].next?.length, 0)
                assert.strict.equal(log1.values[0].refs?.length, 0)
                expect(log1.values[1].next).toEqual([e0.hash])
                assert.strict.equal(log1.values[1].refs?.length, 0)
                expect(log1.values[2].next).toEqual([e1.hash])
                expect(log1.values[2].refs).toEqual([e0.hash])
                expect(log1.heads.map(h => h.hash)).toContainAllValues([e2a.hash])
                expect([...log1._nextsIndexToHead[e0.hash]]).toEqual([e1.hash])

                // fork at root
                const e2ForkAtRoot = await log1.append("2b", { refs: [], nexts: [] })
                expect(log1.values[3].next).toEqual([])
                expect(log1.values[3].refs).toEqual([])
                expect(log1.heads.map(h => h.hash)).toContainAllValues([e2a.hash, e2ForkAtRoot.hash])

                // fork at 0
                const e2ForkAt0 = await log1.append("2c", { refs: [], nexts: [e0.hash] })
                expect(log1.values[4].next).toEqual([e0.hash])
                expect(log1.values[4].refs).toEqual([])
                expect(log1.heads.map(h => h.hash)).toContainAllValues([e2a.hash, e2ForkAtRoot.hash, e2ForkAt0.hash])

                // fork at 1
                const e2ForkAt1 = await log1.append("2d", { refs: [e0.hash], nexts: [e1.hash] })
                expect(log1.values[5].next).toEqual([e1.hash])
                expect(log1.values[5].refs).toEqual([e0.hash])
                expect(log1.heads.map(h => h.hash)).toContainAllValues([e2a.hash, e2ForkAtRoot.hash, e2ForkAt0.hash, e2ForkAt1.hash])

            })
        })
    })
})
