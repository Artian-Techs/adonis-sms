import { test } from '@japa/runner'
import { AppFactory } from '@adonisjs/core/factories/app'
import { configProvider } from '@adonisjs/core'
import type { ApplicationService } from '@adonisjs/core/types'

import { defineConfig, drivers } from '../../src/define_config.js'
import { SNSDriver } from '../../src/drivers/sns.js'
import { TwilioDriver } from '../../src/drivers/twilio.js'
import { VonageDriver } from '../../src/drivers/vonage.js'
import { InfobipDriver } from '../../src/drivers/infobip.js'
import { BASE_URL, FakeDriver } from '../helpers.js'

function createApp() {
  return new AppFactory().create(BASE_URL, () => {}) as ApplicationService
}

test.group('Define config', () => {
  test('resolve the driver config providers to factories', async ({ assert }) => {
    const app = createApp()

    const configProviderResult = defineConfig({
      default: 'twilio',
      from: 'AdonisJS',
      trim: true,
      clients: {
        twilio: drivers.twilio({ accountSid: 'sid', authToken: 'token', from: '+12121212121' }),
      },
    })

    const config = await configProvider.resolve<any>(app, configProviderResult)

    assert.equal(config.default, 'twilio')
    assert.equal(config.from, 'AdonisJS')
    assert.isTrue(config.trim)
    assert.isFunction(config.clients.twilio)
    assert.instanceOf(config.clients.twilio(), TwilioDriver)
  })

  test('accept a plain factory function', async ({ assert }) => {
    const app = createApp()
    const driver = new FakeDriver()

    const config = await configProvider.resolve<any>(
      app,
      defineConfig({
        default: 'fake',
        clients: { fake: () => driver },
      })
    )

    assert.strictEqual(config.clients.fake(), driver)
  })

  test('create every inbuilt driver', async ({ assert }) => {
    const app = createApp()

    const config = await configProvider.resolve<any>(
      app,
      defineConfig({
        default: 'twilio',
        clients: {
          twilio: drivers.twilio({ accountSid: 'sid', authToken: 'token', from: '+12121212121' }),
          vonage: drivers.vonage({ apiKey: 'key', apiSecret: 'secret' }),
          sns: drivers.sns({
            key: 'key',
            secret: 'secret',
            region: 'eu-central-1',
            type: 'Promotional',
          }),
          infobip: drivers.infobip({ baseUrl: 'https://foo.com', apiKey: 'key' }),
        },
      })
    )

    assert.instanceOf(config.clients.twilio(), TwilioDriver)
    assert.instanceOf(config.clients.vonage(), VonageDriver)
    assert.instanceOf(config.clients.sns(), SNSDriver)
    assert.instanceOf(config.clients.infobip(), InfobipDriver)
  })

  test('accept the enum backed options as plain strings', async ({ assert }) => {
    const app = createApp()

    const config = await configProvider.resolve<any>(
      app,
      defineConfig({
        default: 'infobip',
        clients: {
          infobip: drivers.infobip({
            baseUrl: 'https://foo.com',
            apiKey: 'key',
            authType: 'App',
            webhookContentType: 'application/json',
          }),
          sns: drivers.sns({
            key: 'key',
            secret: 'secret',
            region: 'eu-central-1',
            type: 'Transactional',
          }),
        },
      })
    )

    assert.instanceOf(config.clients.infobip(), InfobipDriver)
    assert.instanceOf(config.clients.sns(), SNSDriver)
  })

  test('report that SNS does not accept a webhook', async ({ assert }) => {
    const app = createApp()

    const config = await configProvider.resolve<any>(
      app,
      defineConfig({
        default: 'sns',
        clients: {
          sns: drivers.sns({
            key: 'key',
            secret: 'secret',
            region: 'eu-central-1',
            type: 'Promotional',
          }),
        },
      })
    )

    assert.isFalse(config.clients.sns().acceptWebhook)
  })
})
