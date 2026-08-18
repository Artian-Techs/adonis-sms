import { test } from '@japa/runner'
import { IgnitorFactory } from '@adonisjs/core/factories'

import { SmsManager, SmsClient, defineConfig, drivers } from '../../index.js'

const BASE_URL = new URL('./tmp/', import.meta.url)
const IMPORTER = (filePath: string) => {
  if (filePath.startsWith('./') || filePath.startsWith('../')) {
    return import(new URL(filePath, BASE_URL).href)
  }

  return import(filePath)
}

function createIgnitor(config: any) {
  return new IgnitorFactory()
    .merge({
      rcFileContents: {
        providers: [() => import('../../providers/sms_provider.js')],
      },
    })
    .withCoreConfig()
    .withCoreProviders()
    .merge({ config: { sms: config } })
    .create(BASE_URL, { importer: IMPORTER })
}

test.group('Sms provider', () => {
  test('register the sms manager with the container', async ({ assert }) => {
    const ignitor = createIgnitor(
      defineConfig({
        default: 'twilio',
        from: 'AdonisJS',
        clients: {
          twilio: drivers.twilio({
            accountSid: 'sid',
            authToken: 'token',
            from: '+12121212121',
          }),
        },
      })
    )

    const app = ignitor.createApp('web')
    await app.init()
    await app.boot()

    assert.instanceOf(await app.container.make('sms.manager'), SmsManager)
    assert.instanceOf(await app.container.make(SmsClient), SmsClient)
  })

  test('resolve the same manager instance every time', async ({ assert }) => {
    const ignitor = createIgnitor(
      defineConfig({
        default: 'twilio',
        clients: {
          twilio: drivers.twilio({
            accountSid: 'sid',
            authToken: 'token',
            from: '+12121212121',
          }),
        },
      })
    )

    const app = ignitor.createApp('web')
    await app.init()
    await app.boot()

    assert.strictEqual(
      await app.container.make('sms.manager'),
      await app.container.make('sms.manager')
    )
  })

  test('throw an error when the config is invalid', async () => {
    const ignitor = createIgnitor({})

    const app = ignitor.createApp('web')
    await app.init()
    await app.boot()

    await app.container.make('sms.manager')
  }).throws('Invalid "config/sms.ts" file. Make sure you are using the "defineConfig" method')
})
