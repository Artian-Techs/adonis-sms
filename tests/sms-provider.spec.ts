import { test } from '@japa/runner'
import SmsManager from '../src/Sms/SmsManager'
import { setup, fs } from '../bin/test/config'

test.group('Sms Provider', (group) => {
  group.each.teardown(async () => {
    await fs.cleanup()
  })

  test('register sms provider', async ({ expect }) => {
    const app = await setup()
    expect(app.container.resolveBinding('Adonis/Addons/Sms')).toBeInstanceOf(SmsManager)
    expect(app.container.resolveBinding('Adonis/Addons/Sms')['app']).toStrictEqual(app)
    expect(app.container.resolveBinding('Adonis/Addons/Sms')).toStrictEqual(
      app.container.resolveBinding('Adonis/Addons/Sms')
    )
  })

  test('register repl binding', async ({ expect }) => {
    const app = await setup('repl')
    const replCustomMethods = app.container.resolveBinding('Adonis/Addons/Repl')['customMethods']

    for (const method of ['loadSms', 'loadSmsers']) {
      expect(replCustomMethods).toHaveProperty(method)
      expect(replCustomMethods[method]['handler']).toEqual(expect.any(Function))
    }
  })
})
