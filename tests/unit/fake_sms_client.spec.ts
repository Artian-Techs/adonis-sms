import { test } from '@japa/runner'

import { SmsManager } from '../../src/sms_manager.js'
import { FakeSmsClient } from '../../src/fake_sms_client.js'
import { createEmitter, FakeDriver, sleep } from '../helpers.js'

function createManager() {
  const twilio = new FakeDriver({ from: 'Twilio' })

  const manager = new SmsManager(createEmitter(), {
    default: 'twilio' as const,
    from: 'AdonisJS',
    clients: { twilio: () => twilio },
  })

  return { manager, twilio }
}

test.group('Fake client', () => {
  test('resolve every client to the fake one', ({ assert }) => {
    const { manager } = createManager()
    const fake = manager.fake()

    assert.instanceOf(manager.use(), FakeSmsClient)
    assert.strictEqual(manager.use(), fake)
    assert.strictEqual(manager.use('twilio'), fake)
  })

  test('record messages instead of delivering them', async ({ assert }) => {
    const { manager, twilio } = createManager()
    const fake = manager.fake()

    await manager.send((message) => {
      message.to('+12121212121').message('Hello world')
    })

    assert.lengthOf(twilio.sent, 0)
    assert.lengthOf(fake.sentMessages, 1)
    assert.deepEqual(fake.sentMessages[0].message, {
      from: 'AdonisJS',
      to: '+12121212121',
      message: 'Hello world',
    })
  })

  test('record queued messages without hitting the queue', async ({ assert }) => {
    const { manager, twilio } = createManager()
    const fake = manager.fake()

    await manager.sendLater((message) => {
      message.to('+12121212121').message('Hello world')
    })

    await sleep()
    assert.lengthOf(twilio.sent, 0)
    assert.isTrue(fake.sentMessages[0].queued)
    fake.assertQueued()
  })

  test('restore the real clients', async ({ assert }) => {
    const { manager, twilio } = createManager()

    manager.fake()
    manager.restore()

    await manager.send((message) => {
      message.to('+12121212121').message('Hello world')
    })

    assert.lengthOf(twilio.sent, 1)
    assert.notInstanceOf(manager.use(), FakeSmsClient)
  })

  test('assertSent passes when a matching message was sent', async ({ assert }) => {
    const { manager } = createManager()
    const fake = manager.fake()

    await manager.send((message) => {
      message.to('+12121212121').message('Hello world')
    })

    fake.assertSent()
    fake.assertSent((sms) => sms.message.to === '+12121212121')
    assert.throws(
      () => fake.assertSent((sms) => sms.message.to === '+19999999999'),
      /Expected an sms matching the given predicate to have been sent/
    )
  })

  test('assertNotSent and assertNoneSent', async ({ assert }) => {
    const { manager } = createManager()
    const fake = manager.fake()

    fake.assertNoneSent()
    fake.assertNotSent()

    await manager.send((message) => {
      message.to('+12121212121').message('Hello world')
    })

    fake.assertNotSent((sms) => sms.message.to === '+19999999999')
    assert.throws(() => fake.assertNoneSent(), /Expected 0 sms to have been sent, but got 1/)
  })

  test('assertSentCount', async ({ assert }) => {
    const { manager } = createManager()
    const fake = manager.fake()

    for (const to of ['+12121212121', '+13131313131']) {
      await manager.send((message) => {
        message.to(to).message('Hello world')
      })
    }

    fake.assertSentCount(2)
    fake.assertSentCount(1, (sms) => sms.message.to === '+13131313131')
    assert.throws(() => fake.assertSentCount(3), /Expected 3 sms to have been sent, but got 2/)
  })

  test('find and filter the recorded messages', async ({ assert }) => {
    const { manager } = createManager()
    const fake = manager.fake()

    await manager.send((message) => {
      message.to('+12121212121').message('First')
    })
    await manager.send((message) => {
      message.to('+13131313131').message('Second')
    })

    assert.equal(fake.find((sms) => sms.message.to === '+13131313131')?.message.message, 'Second')
    assert.lengthOf(fake.filter(), 2)
    assert.isUndefined(fake.find((sms) => sms.message.to === '+19999999999'))
  })

  test('clear the recorded messages', async ({ assert }) => {
    const { manager } = createManager()
    const fake = manager.fake()

    await manager.send((message) => {
      message.to('+12121212121').message('Hello world')
    })

    fake.clear()
    assert.lengthOf(fake.sentMessages, 0)
  })
})
