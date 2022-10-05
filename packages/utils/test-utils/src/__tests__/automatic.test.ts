
import { Session } from '../session.js'
describe(`Session`, function () {
    let session: Session;
    beforeEach(async () => {
        session = await Session.connected(3);
    })
    it('starts and stops two connected nodes', async () => {
        expect(session.peers).toHaveLength(3);
        for (const peer of session.peers) {
            expect(peer.id).toBeDefined();
            expect(peer.ipfs).toBeDefined();
            expect(peer.ipfsd).toBeDefined();
            expect((await peer.ipfsd.api.swarm.peers()).length).toEqual(2)
        }
    })

    afterEach(async () => {
        await session.stop()
    })
})