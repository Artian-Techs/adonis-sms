import { test } from '@japa/runner'

import { SmsClient } from '../../src/sms_client.js'
import { SmsManager } from '../../src/sms_manager.js'
import { createEmitter, FakeDriver, sleep } from '../helpers.js'

function createManager() {
  const twilio = new FakeDriver({ from: 'Twilio' })
  const vonage = new FakeDriver({ from: 'Vonage' })

  const manager = new SmsManager(createEmitter(), {
    default: 'twilio' as const,
    from: 'AdonisJS',
    clients: {
      twilio: () => twilio,
      vonage: () => vonage,
    },
  })

  return { manager, twilio, vonage }
}

test.group('Sms manager', () => {
  test('return a client instance for the default mapping', ({ assert }) => {
    const { manager, twilio } = createManager()
    const client = manager.use()

    assert.instanceOf(client, SmsClient)
    assert.strictEqual(client.driver, twilio)
    assert.equal(client.name, 'twilio')
  })

  test('return a client instance for a named mapping', ({ assert }) => {
    const { manager, vonage } = createManager()

    assert.strictEqual(manager.use('vonage').driver, vonage)
  })

  test('cache the client instances', ({ assert }) => {
    const { manager } = createManager()

    assert.strictEqual(manager.use(), manager.use())
    assert.strictEqual(manager.use('vonage'), manager.use('vonage'))
    assert.notStrictEqual(manager.use(), manager.use('vonage'))
  })

  test('fail when no default client is configured', ({ assert }) => {
    const manager = new SmsManager(createEmitter(), {
      clients: { twilio: () => new FakeDriver() },
    })

    assert.throws(
      () => manager.use(),
      'Cannot create client instance. No default client is defined in the config'
    )
  })

  test('fail when the client is not configured', ({ assert }) => {
    const { manager } = createManager()

    assert.throws(
      () => manager.use('foo' as any),
      'Unknown client "foo". Make sure it is configured inside the config file'
    )
  })

  test('share the global config with the clients', ({ assert }) => {
    const { manager } = createManager()

    assert.equal(manager.use().config.from, 'AdonisJS')
  })

  test('proxy "send" to the default client', async ({ assert }) => {
    const { manager, twilio } = createManager()

    await manager.send((message) => {
      message.to('+12121212121').message('Hello world')
    })

    assert.lengthOf(twilio.sent, 1)
    assert.equal(twilio.sent[0].message.from, 'Twilio')
  })

  test('proxy "sendMany" and "sendBulk" to the default client', async ({ assert }) => {
    const { manager, twilio } = createManager()

    await manager.sendMany((message) => {
      message.to(['+12121212121']).message('Hello world')
    })
    await manager.sendBulk((message) => {
      message.to([['+12121212121', 'Hello world']])
    })

    assert.deepEqual(
      twilio.sent.map(({ method }) => method),
      ['sendMany', 'send']
    )
  })

  test('proxy "sendLater" to the default client', async ({ assert }) => {
    const { manager, twilio } = createManager()

    await manager.sendLater((message) => {
      message.to('+12121212121').message('Hello world')
    })

    await sleep()
    assert.lengthOf(twilio.sent, 1)
  })

  test('configure a custom messenger for all the clients', async ({ assert }) => {
    const { manager, twilio } = createManager()
    const queued: any[] = []

    /**
     * The "twilio" client is created before the messenger is registered to
     * assert that the cached instances are updated as well
     */
    manager.use('twilio')
    manager.setMessenger(() => ({
      async queue(sms) {
        queued.push(sms)
      },
    }))

    await manager.sendLater((message) => {
      message.to('+12121212121').message('Hello world')
    })
    await manager.use('vonage').sendLater((message) => {
      message.to('+12121212121').message('Hello world')
    })

    await sleep()
    assert.lengthOf(twilio.sent, 0)
    assert.lengthOf(queued, 2)
  })
})
