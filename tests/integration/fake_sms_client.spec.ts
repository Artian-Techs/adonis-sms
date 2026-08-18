import { test } from '@japa/runner'
import { IgnitorFactory } from '@adonisjs/core/factories'

import { FakeSmsClient, defineConfig, drivers } from '../../index.js'

const BASE_URL = new URL('./tmp/', import.meta.url)
const IMPORTER = (filePath: string) => {
  if (filePath.startsWith('./') || filePath.startsWith('../')) {
    return import(new URL(filePath, BASE_URL).href)
  }

  return import(filePath)
}

/**
 * Boots a real application with the provider registered, so the fake is
 * exercised through the container rather than through a hand-built manager
 */
async function bootApp() {
  const ignitor = new IgnitorFactory()
    .merge({ rcFileContents: { providers: [() => import('../../providers/sms_provider.js')] } })
    .withCoreConfig()
    .withCoreProviders()
    .merge({
      config: {
        sms: defineConfig({
          default: 'twilio',
          from: 'AdonisJS',
          clients: {
            twilio: drivers.twilio({
              accountSid: 'ACxxx',
              authToken: 'token',
              from: '+12121212121',
            }),
          },
        }),
      },
    })
    .create(BASE_URL, { importer: IMPORTER })

  const app = ignitor.createApp('web')
  await app.init()
  await app.boot()

  return app
}

test.group('Fake client | integration', (group) => {
  group.each.timeout(10_000)

  test('fake the client resolved from the container', async ({ assert }) => {
    const app = await bootApp()
    const sms = await app.container.make('sms.manager')

    const fake = sms.fake()

    try {
      assert.instanceOf(sms.use(), FakeSmsClient)

      /**
       * The Twilio credentials above are bogus. Reaching the provider would
       * throw, so a resolved send proves nothing left the process
       */
      await sms.send((message) => {
        message.to('+13131313131').message('Hello world')
      })

      fake.assertSentCount(1)
      fake.assertSent((recorded) => recorded.message.to === '+13131313131')
      /**
       * The fake replaces every client with a single recorder, so it cannot
       * know which driver would have handled the message. The sender falls
       * back to the global "from" rather than the Twilio number
       */
      assert.equal(fake.sentMessages[0].message.from, 'AdonisJS')
    } finally {
      sms.restore()
    }
  })

  test('restore the real client afterwards', async ({ assert }) => {
    const app = await bootApp()
    const sms = await app.container.make('sms.manager')

    sms.fake()
    sms.restore()

    assert.notInstanceOf(sms.use(), FakeSmsClient)

    /**
     * Back on the real driver, the bogus credentials must now surface
     */
    await assert.rejects(async () => {
      await sms.send((message) => {
        message.to('+13131313131').message('Hello world')
      })
    })
  })
})
