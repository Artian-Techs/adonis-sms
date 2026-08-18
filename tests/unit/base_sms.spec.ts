import { test } from '@japa/runner'

import { SmsClient } from '../../src/sms_client.js'
import { SmsResponse } from '../../src/sms_response.js'
import { BaseSms } from '../../src/base_sms.js'
import { createEmitter, FakeDriver, sleep } from '../helpers.js'

class NotifyUser extends BaseSms {
  from = 'AdonisJS'

  prepare() {
    this.message.to('+12121212121').message('Hello world')
  }
}

test.group('Base client', () => {
  test('send the message using the given client', async ({ assert }) => {
    const driver = new FakeDriver()
    const client = new SmsClient('fake', driver, createEmitter())

    const response = await new NotifyUser().send(client)

    assert.instanceOf(response, SmsResponse)
    assert.equal(response.messageId, 'send-id')
    assert.deepEqual(driver.sent[0].message, {
      from: 'AdonisJS',
      to: '+12121212121',
      message: 'Hello world',
    })
  })

  test('build the message only once', async ({ assert }) => {
    let prepareCalls = 0

    class CountingSms extends BaseSms {
      from = 'AdonisJS'

      prepare() {
        prepareCalls++
        this.message.to('+12121212121').message('Hello world')
      }
    }

    const client = new SmsClient('fake', new FakeDriver(), createEmitter())
    const mail = new CountingSms()

    await mail.build()
    await mail.send(client)

    assert.equal(prepareCalls, 1)
  })

  test('queue the message using the given client', async ({ assert }) => {
    const driver = new FakeDriver()
    const client = new SmsClient('fake', driver, createEmitter())

    await new NotifyUser().sendLater(client)

    await sleep()
    assert.lengthOf(driver.sent, 1)
    assert.equal(driver.sent[0].message.from, 'AdonisJS')
  })

  test('support an async prepare method', async ({ assert }) => {
    class AsyncSms extends BaseSms {
      from = 'AdonisJS'

      async prepare() {
        await sleep(1)
        this.message.to('+12121212121').message('Hello world')
      }
    }

    const driver = new FakeDriver()
    await new AsyncSms().send(new SmsClient('fake', driver, createEmitter()))

    assert.equal(driver.sent[0].message.message, 'Hello world')
  })
})
