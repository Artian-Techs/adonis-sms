import type { ApplicationContract } from '@ioc:Adonis/Core/Application'

import { test } from '@japa/runner'
import { join } from 'path'
import importFresh from 'import-fresh'
import { Kernel } from '@adonisjs/ace'
import { Filesystem } from '@poppinss/dev-utils'
import { Application } from '@adonisjs/application'

import MakeSmser from '../commands/MakeSmser'

const fs = new Filesystem(join(__dirname, '__app'))
const templates = new Filesystem(join(__dirname, '..', 'templates'))

test.group('Make Smser', (group) => {
  group.setup(() => {
    process.env.ADONIS_ACE_CWD = fs.basePath
  })

  group.teardown(() => {
    delete process.env.ADONIS_ACE_CWD
  })

  group.each.teardown(async () => {
    await fs.cleanup()
  })

  test('make an smser inside the default directory', async ({ expect }) => {
    await fs.add('.adonisrc.json', JSON.stringify({}))

    const rcContents = importFresh(join(fs.basePath, '.adonisrc.json')) as any
    const app = new Application(fs.basePath, 'test', rcContents)

    const smser = new MakeSmser(app, new Kernel(app))
    smser.name = 'notifyUser'
    await smser.run()

    const NotifyUserSmser = await fs.get('app/Smsers/NotifyUser.ts')
    const SmserTemplate = await templates.get('smser.txt')

    expect(NotifyUserSmser.split('\n')).toStrictEqual(
      SmserTemplate.replace(/{{filename}}/g, 'NotifyUser').split('\n')
    )
  })

  test('make an smser inside a custom directory', async ({ expect }) => {
    await fs.add(
      '.adonisrc.json',
      JSON.stringify({
        aliases: {
          App: './app',
        },
        namespaces: {
          smsers: 'App/My/Smsers',
        },
      })
    )

    const rcContents = importFresh(join(fs.basePath, '.adonisrc.json')) as any
    const app = new Application(fs.basePath, 'test', rcContents)

    const smser = new MakeSmser(app, new Kernel(app))
    smser.name = 'notifyUser'
    await smser.run()

    const NotifyUserSmser = await fs.get('app/My/Smsers/NotifyUser.ts')
    const SmserTemplate = await templates.get('smser.txt')

    expect(NotifyUserSmser.split('\n')).toStrictEqual(
      SmserTemplate.replace(/{{filename}}/g, 'NotifyUser').split('\n')
    )
  })
})
