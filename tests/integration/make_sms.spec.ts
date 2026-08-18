import { test } from '@japa/runner'
import { AceFactory } from '@adonisjs/core/factories'

import MakeSms from '../../commands/make_sms.js'

test.group('MakeSms', () => {
  test('make a client class using the stub', async ({ assert, fs }) => {
    const ace = await new AceFactory().make(fs.baseUrl, { importer: () => {} })
    await ace.app.init()
    ace.ui.switchMode('raw')

    const command = await ace.create(MakeSms, ['notify_user'])
    await command.exec()

    command.assertLog('green(DONE:)    create app/sms/notify_user.ts')
    await assert.fileContains(
      'app/sms/notify_user.ts',
      `import { BaseSms } from '@artian-techs/adonis-sms'`
    )
    await assert.fileContains(
      'app/sms/notify_user.ts',
      'export default class NotifyUser extends BaseSms {'
    )
  })

  test('make a client class inside a nested directory', async ({ assert, fs }) => {
    const ace = await new AceFactory().make(fs.baseUrl, { importer: () => {} })
    await ace.app.init()
    ace.ui.switchMode('raw')

    const command = await ace.create(MakeSms, ['users/notify_user'])
    await command.exec()

    command.assertLog('green(DONE:)    create app/sms/users/notify_user.ts')
    await assert.fileContains(
      'app/sms/users/notify_user.ts',
      'export default class NotifyUser extends BaseSms {'
    )
  })
})
