import { test } from '@japa/runner'
import { configProvider } from '@adonisjs/core'
import { AppFactory } from '@adonisjs/core/factories/app'
import type { ApplicationService } from '@adonisjs/core/types'

import { BaseDriver } from '../../src/drivers/base_driver.js'
import { SmsResponse } from '../../src/sms_response.js'
import { SmsManager } from '../../src/sms_manager.js'
import { defineConfig, drivers } from '../../src/define_config.js'
import type {
  InferSmsClients,
  ManyMessagesNode,
  MessageNode,
  SmsDriverConfig,
} from '../../src/types.js'
import { BASE_URL, createEmitter } from '../helpers.js'

/*
|--------------------------------------------------------------------------
| The custom driver documented in the README
|--------------------------------------------------------------------------
*/

type MyProviderConfig = SmsDriverConfig & {
  apiKey: string
}

type MyProviderRuntimeOptions = {
  webhook?: string
  priority?: 'normal' | 'high'
}

type MyProviderResponse = {
  id: string
  status: string
}

class MyProviderDriver extends BaseDriver {
  calls: Array<{ method: string; payload: any }> = []

  constructor(protected config: MyProviderConfig) {
    super(config)
  }

  async send(
    { from, to, message }: MessageNode,
    options?: MyProviderRuntimeOptions
  ): Promise<SmsResponse<MyProviderResponse>> {
    this.calls.push({
      method: 'send',
      payload: {
        sender: from,
        recipient: to,
        text: message,
        priority: options?.priority ?? 'normal',
        callback_url: options?.webhook,
      },
    })

    const response: MyProviderResponse = { id: 'message-1', status: 'accepted' }

    return new SmsResponse(response.id, response)
  }

  async sendMany(
    { from, to, message }: ManyMessagesNode,
    options?: MyProviderRuntimeOptions
  ): Promise<SmsResponse<MyProviderResponse>[]> {
    return Promise.all(to.map((recipient) => this.send({ from, to: recipient, message }, options)))
  }
}

const smsConfig = defineConfig({
  default: 'myProvider',
  from: 'AdonisJS',
  clients: {
    myProvider: () => new MyProviderDriver({ apiKey: 'key' }),
    twilio: drivers.twilio({ accountSid: 'sid', authToken: 'token', from: '+12121212121' }),
  },
})

type KnownClients = InferSmsClients<typeof smsConfig>

async function createManager() {
  const app = new AppFactory().create(BASE_URL, () => {}) as ApplicationService
  const config = await configProvider.resolve<any>(app, smsConfig)

  return new SmsManager<KnownClients>(createEmitter(), config)
}

test.group('Custom driver', () => {
  test('register a plain factory alongside the inbuilt drivers', async ({ assert }) => {
    const manager = await createManager()

    assert.instanceOf(manager.use('myProvider').driver, MyProviderDriver)
  })

  test('send a message through the custom driver', async ({ assert }) => {
    const manager = await createManager()
    const client = manager.use('myProvider')

    const response = await client.send(
      (message) => {
        message.to('+12121212121').message('Hello world')
      },
      { priority: 'high' }
    )

    assert.instanceOf(response, SmsResponse)
    assert.equal(response.messageId, 'message-1')
    assert.deepEqual(response.original, { id: 'message-1', status: 'accepted' })
    assert.deepEqual(client.driver.calls[0].payload, {
      sender: 'AdonisJS',
      recipient: '+12121212121',
      text: 'Hello world',
      priority: 'high',
      callback_url: undefined,
    })
  })

  test('fall back to multiple "send" calls when "sendBulk" is not implemented', async ({
    assert,
  }) => {
    const manager = await createManager()
    const client = manager.use('myProvider')

    await client.sendBulk((message) => {
      message.to([
        ['+12121212121', 'Message 1'],
        ['+13131313131', 'Message 2'],
      ])
    })

    assert.lengthOf(client.driver.calls, 2)
    assert.deepEqual(
      client.driver.calls.map(({ payload }) => payload.text),
      ['Message 1', 'Message 2']
    )
  })

  test('forward the resolved webhook to the custom driver', async ({ assert }) => {
    const app = new AppFactory().create(BASE_URL, () => {}) as ApplicationService
    const config = await configProvider.resolve<any>(
      app,
      defineConfig({
        default: 'myProvider',
        from: 'AdonisJS',
        webhook: 'https://example.com/sms/webhook',
        clients: { myProvider: () => new MyProviderDriver({ apiKey: 'key' }) },
      })
    )

    const client = new SmsManager(createEmitter(), config).use('myProvider')
    await client.send((message) => {
      message.to('+12121212121').message('Hello world')
    })

    assert.equal(
      (client.driver as MyProviderDriver).calls[0].payload.callback_url,
      'https://example.com/sms/webhook'
    )
  })

  test('infer the runtime options and the response of the custom driver', ({ expectTypeOf }) => {
    type SmsClient = ReturnType<KnownClients['myProvider']>

    expectTypeOf<SmsClient>().toEqualTypeOf<MyProviderDriver>()
    expectTypeOf<Parameters<SmsClient['send']>[1]>().toEqualTypeOf<
      MyProviderRuntimeOptions | undefined
    >()
    expectTypeOf<Awaited<ReturnType<SmsClient['send']>>>().toEqualTypeOf<
      SmsResponse<MyProviderResponse>
    >()
  })
})
