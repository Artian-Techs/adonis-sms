import { test } from '@japa/runner'

import { SmsClient } from '../../src/sms_client.js'
import { SmsResponse } from '../../src/sms_response.js'
import { createEmitter, FakeDriver, FailingDriver, sleep } from '../helpers.js'

test.group('SmsClient | send', () => {
  test('send a message using the driver', async ({ assert }) => {
    const driver = new FakeDriver()
    const client = new SmsClient('fake', driver, createEmitter())

    const response = await client.send((message) => {
      message.from('AdonisJS').to('+12121212121').message('Hello world')
    })

    assert.instanceOf(response, SmsResponse)
    assert.equal(response.messageId, 'send-id')
    assert.deepEqual(response.original, { id: 'send' })
    assert.deepEqual(driver.sent[0].message, {
      from: 'AdonisJS',
      to: '+12121212121',
      message: 'Hello world',
    })
  })

  test('use the driver "from" when the message does not define one', async ({ assert }) => {
    const driver = new FakeDriver({ from: 'DriverSender' })
    const client = new SmsClient('fake', driver, createEmitter(), { from: 'GlobalSender' })

    await client.send((message) => {
      message.to('+12121212121').message('Hello world')
    })

    assert.equal(driver.sent[0].message.from, 'DriverSender')
  })

  test('use the global "from" when neither the message nor the driver define one', async ({
    assert,
  }) => {
    const driver = new FakeDriver()
    const client = new SmsClient('fake', driver, createEmitter(), { from: 'GlobalSender' })

    await client.send((message) => {
      message.to('+12121212121').message('Hello world')
    })

    assert.equal(driver.sent[0].message.from, 'GlobalSender')
  })

  test('fail when no sender is defined anywhere', async ({ assert }) => {
    const client = new SmsClient('fake', new FakeDriver(), createEmitter())

    await assert.rejects(async () => {
      await client.send((message) => {
        message.to('+12121212121').message('Hello world')
      })
    }, /You must provide at least one "from" address/)
  })

  test('append the webhook to the driver options', async ({ assert }) => {
    const driver = new FakeDriver({ from: 'AdonisJS', webhook: 'https://foo.com/webhook' })
    const client = new SmsClient('fake', driver, createEmitter())

    await client.send((message) => {
      message.to('+12121212121').message('Hello world')
    })

    assert.equal(driver.sent[0].config.webhook, 'https://foo.com/webhook')
  })

  test('do not append the webhook when the driver does not accept one', async ({ assert }) => {
    const driver = new FakeDriver(
      { from: 'AdonisJS', webhook: 'https://foo.com/webhook' },
      { acceptWebhook: false }
    )
    const client = new SmsClient('fake', driver, createEmitter())

    await client.send((message) => {
      message.to('+12121212121').message('Hello world')
    })

    assert.isUndefined(driver.sent[0].config)
  })

  test('fail when the webhook is not a valid URL', async ({ assert }) => {
    const driver = new FakeDriver({ from: 'AdonisJS', webhook: 'foo' })
    const client = new SmsClient('fake', driver, createEmitter())

    await assert.rejects(async () => {
      await client.send((message) => {
        message.to('+12121212121').message('Hello world')
      })
    }, '"foo" is not a valid URL')
  })

  test('fail when the webhook uses an unsupported protocol', async ({ assert }) => {
    const driver = new FakeDriver({ from: 'AdonisJS', webhook: 'ftp://foo.com' })
    const client = new SmsClient('fake', driver, createEmitter())

    await assert.rejects(async () => {
      await client.send((message) => {
        message.to('+12121212121').message('Hello world')
      })
    }, '"ftp" is not a valid protocol. Valid protocols are HTTP and HTTPS')
  })

  test('emit the "sms:sending" and "sms:sent" events', async ({ assert }) => {
    const emitter = createEmitter()
    const events: string[] = []

    emitter.on('sms:sending', () => events.push('sms:sending'))
    emitter.on('sms:sent', () => events.push('sms:sent'))

    const client = new SmsClient('fake', new FakeDriver({ from: 'AdonisJS' }), emitter)
    await client.send((message) => {
      message.to('+12121212121').message('Hello world')
    })

    assert.deepEqual(events, ['sms:sending', 'sms:sent'])
  })
})

test.group('SmsClient | sendMany', () => {
  test('send the same message to many recipients', async ({ assert }) => {
    const driver = new FakeDriver({ from: 'AdonisJS' })
    const client = new SmsClient('fake', driver, createEmitter())

    const response = await client.sendMany((message) => {
      message.to(['+12121212121', '+11111111111']).message('Hello world')
    })

    assert.lengthOf(response, 1)
    assert.equal(response[0].messageId, 'send-many-id')
    assert.deepEqual(response[0].original, { id: 'sendMany' })
    assert.deepEqual(driver.sent[0].message.to, ['+12121212121', '+11111111111'])
  })
})

test.group('SmsClient | sendBulk', () => {
  test('use the driver "sendBulk" when it is implemented', async ({ assert }) => {
    const driver = new FakeDriver({ from: 'AdonisJS' }, { withBulk: true })
    const client = new SmsClient('fake', driver, createEmitter())

    await client.sendBulk((message) => {
      message.to([
        ['+12121212121', 'Message 1'],
        ['+11111111111', 'Message 2'],
      ])
    })

    assert.lengthOf(driver.sent, 1)
    assert.equal(driver.sent[0].method, 'sendBulk')
  })

  test('fallback to multiple "send" calls when "sendBulk" is missing', async ({ assert }) => {
    const driver = new FakeDriver({ from: 'AdonisJS' })
    const client = new SmsClient('fake', driver, createEmitter())

    await client.sendBulk((message) => {
      message.to([
        ['+12121212121', 'Message 1'],
        ['+11111111111', 'Message 2'],
      ])
    })

    assert.lengthOf(driver.sent, 2)
    assert.deepEqual(
      driver.sent.map(({ message }) => message.message),
      ['Message 1', 'Message 2']
    )
  })

  test('fail when one of the recipients is invalid', async ({ assert }) => {
    const client = new SmsClient('fake', new FakeDriver({ from: 'AdonisJS' }), createEmitter())

    await assert.rejects(async () => {
      await client.sendBulk((message) => {
        message.to([['foo', 'Message 1']])
      })
    }, /is invalid \(foo\)/)
  })
})

test.group('SmsClient | sendLater', () => {
  test('deliver the message through the in-memory queue', async ({ assert }) => {
    const driver = new FakeDriver({ from: 'AdonisJS' })
    const client = new SmsClient('fake', driver, createEmitter())

    await client.sendLater((message) => {
      message.to('+12121212121').message('Hello world')
    })

    await sleep()
    assert.lengthOf(driver.sent, 1)
    assert.equal(driver.sent[0].message.to, '+12121212121')
  })

  test('emit "queued:sms:error" when the delivery fails', async ({ assert }, done) => {
    const emitter = createEmitter()
    const client = new SmsClient('fake', new FailingDriver({ from: 'AdonisJS' }), emitter)

    emitter.on('queued:sms:error', (event) => {
      assert.equal(event.clientName, 'fake')
      assert.equal(event.error.message, 'Unable to deliver the sms')
      done()
    })

    await client.sendLater((message) => {
      message.to('+12121212121').message('Hello world')
    })
  }).waitForDone()

  test('use a custom messenger', async ({ assert }) => {
    const queued: any[] = []
    const driver = new FakeDriver({ from: 'AdonisJS' })
    const client = new SmsClient('fake', driver, createEmitter())

    client.setMessenger({
      async queue(sms) {
        queued.push(sms)
      },
    })

    await client.sendLater((message) => {
      message.to('+12121212121').message('Hello world')
    })

    await sleep()
    assert.lengthOf(driver.sent, 0)
    assert.lengthOf(queued, 1)
    assert.equal(queued[0].message.to, '+12121212121')
  })
})
