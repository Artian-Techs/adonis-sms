import { test } from '@japa/runner'

import { SNSDriver } from '../../src/drivers/sns.js'
import { TwilioDriver } from '../../src/drivers/twilio.js'
import { VonageDriver } from '../../src/drivers/vonage.js'
import { InfobipDriver } from '../../src/drivers/infobip.js'
import type { BaseDriver } from '../../src/drivers/base_driver.js'

/*
|--------------------------------------------------------------------------
| SDK instantiation
|--------------------------------------------------------------------------
|
| Every driver imports its SDK dynamically. A CommonJS package may not expose
| the constructor as a named export, in which case the destructuring silently
| yields "undefined" and the driver only blows up at send time with a
| "X is not a constructor" TypeError.
|
| The Twilio driver shipped exactly that bug: it type-checked, the whole test
| suite passed, and it was broken for every user. These tests build the SDK
| instance of each driver with dummy credentials. SDK constructors perform no I/O, so
| this stays offline.
|
*/

const factories: Record<string, () => BaseDriver> = {
  twilio: () => new TwilioDriver({ accountSid: 'ACxxx', authToken: 'token', from: '+12121212121' }),
  vonage: () => new VonageDriver({ apiKey: 'key', apiSecret: 'secret' }),
  sns: () =>
    new SNSDriver({ key: 'key', secret: 'secret', region: 'eu-central-1', type: 'Transactional' }),
  infobip: () => new InfobipDriver({ baseUrl: 'https://example.com', apiKey: 'key' }),
}

const names = Object.keys(factories)

test.group('Driver SDK instantiation', () => {
  test('build the {$self} SDK instance without hitting the network')
    .with(names)
    .run(async ({ assert }, name) => {
      const driver = factories[name]() as any
      const sdk = await driver.getSdk()

      assert.isObject(sdk, `the ${name} SDK did not yield an instance`)
    })

  test('cache the {$self} SDK instance across calls')
    .with(names)
    .run(async ({ assert }, name) => {
      const driver = factories[name]() as any
      const sdk = await driver.getSdk()
      const again = await driver.getSdk()

      assert.strictEqual(sdk, again)
    })
})
