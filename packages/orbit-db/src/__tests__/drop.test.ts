
const assert = require('assert')
const fs = require('fs')
const path = require('path')
const rmrf = require('rimraf')
import { OrbitDB } from '../orbit-db'
import { FEED_STORE_TYPE } from './utils/stores'

// Include test utilities
const {
  config,
  startIpfs,
  stopIpfs,
  testAPIs,
} = require('orbit-db-test-utils')

const dbPath = './orbitdb/tests/drop'

Object.keys(testAPIs).forEach(API => {
  describe(`orbit-db - Drop Database (${API})`, function () {
    jest.setTimeout(config.timeout)

    let ipfsd, ipfs, orbitdb: OrbitDB, db, address
    let localDataPath

    beforeAll(async () => {
      rmrf.sync(dbPath)
      ipfsd = await startIpfs(API, config.daemon1)
      ipfs = ipfsd.api
      orbitdb = await OrbitDB.createInstance(ipfs, { directory: dbPath })
    })

    afterAll(async () => {
      if (orbitdb)
        await orbitdb.stop()

      if (ipfsd)
        await stopIpfs(ipfsd)

      rmrf.sync(dbPath)
    })

    describe('Drop', function () {
      beforeAll(async () => {
        db = await orbitdb.create('first', FEED_STORE_TYPE)
        localDataPath = path.join(dbPath)
        assert.equal(fs.existsSync(localDataPath), true)
      })

      it('removes local database cache', async () => {
        await db.drop()
        await db._cache.open()
        assert.equal(await db._cache.get(db.localHeadsPath), undefined)
        assert.equal(await db._cache.get(db.remoteHeadsPath), undefined)
        assert.equal(await db._cache.get(db.snapshotPath), undefined)
        assert.equal(await db._cache.get(db.queuePath), undefined)
        assert.equal(await db._cache.get(db.manifestPath), undefined)
        await db._cache.close()
      })
    })
  })
})