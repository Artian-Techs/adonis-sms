import { test } from '@japa/runner'
import { setup, fs } from '../bin/test/config'

test.group('Sms - Vonage', (group) => {
  group.teardown(async () => {
    await fs.cleanup()
  })

  test('send one Sms', async ({ expect }) => {
    const app = await setup()
    const Sms = app.container.resolveBinding('Adonis/Addons/Sms')

    await Sms.use('infobip').send((sms) => {
      sms
        .from('AdonisJS')
        .to('+213655151996')
        .to('+34634071204')
        .message('Test same Sms to multiple recipients.')
    })
  }).disableTimeout()

  test('send bulk Sms', async ({ expect }) => {
    const app = await setup()
    const Sms = app.container.resolveBinding('Adonis/Addons/Sms')

    await Sms.use('infobip').sendBulk((sms) => {
      sms.from('AdonisJS').toAll([
        ['+213655151996', 'Hello Algeria 4'],
        ['+34634071204', 'Hello Spain 4'],
      ])
    })
  }).disableTimeout()
})
