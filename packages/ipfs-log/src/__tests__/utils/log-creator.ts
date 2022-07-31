import { Log as TypeOfLog } from "../../log"

export class LogCreator {
  static async createLogWithSixteenEntries(Log, ipfs, identities) {
    const create = async (): Promise<TypeOfLog<string>> => {
      const logA = new Log(ipfs, identities[0], { logId: 'X' })
      const logB = new Log(ipfs, identities[1], { logId: 'X' })
      const log3 = new Log(ipfs, identities[2], { logId: 'X' })
      const log = new Log(ipfs, identities[3], { logId: 'X' })

      for (let i = 1; i <= 5; i++) {
        await logA.append('entryA' + i)
      }
      for (let i = 1; i <= 5; i++) {
        await logB.append('entryB' + i)
      }
      await log3.join(logA)
      await log3.join(logB)
      for (let i = 6; i <= 10; i++) {
        await logA.append('entryA' + i)
      }
      await log.join(log3)
      await log.append('entryC0')
      await log.join(logA)
      return log
    }

    const expectedData = [
      'entryA1', 'entryB1', 'entryA2', 'entryB2', 'entryA3', 'entryB3',
      'entryA4', 'entryB4', 'entryA5', 'entryB5',
      'entryA6',
      'entryC0',
      'entryA7', 'entryA8', 'entryA9', 'entryA10'
    ]

    const log = await create()
    return { log: log, expectedData: expectedData, json: log.toJSON() }
  }

  static async createLogWithTwoHundredEntries(Log, ipfs, identities) {
    const amount = 100

    const expectedData: string[] = []

    const create = async (): Promise<TypeOfLog<string>> => {
      const logA = new Log(ipfs, identities[0], { logId: 'X' })
      const logB = new Log(ipfs, identities[1], { logId: 'X' })
      for (let i = 1; i <= amount; i++) {
        await logA.append('entryA' + i)
        await logB.join(logA)
        await logB.append('entryB' + i)
        await logA.join(logB)
        expectedData.push('entryA' + i)
        expectedData.push('entryB' + i)
      }
      return logA
    }

    const log = await create()
    return { log: log, expectedData: expectedData }
  }
}

