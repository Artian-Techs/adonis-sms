import { test } from '@japa/runner'
import { fileURLToPath } from 'node:url'
import { IgnitorFactory } from '@adonisjs/core/factories'
import Configure from '@adonisjs/core/commands/configure'

const BASE_URL = new URL('../tmp/', import.meta.url)

async function createApp(fsBaseUrl: URL) {
  const ignitor = new IgnitorFactory()
    .withCoreProviders()
    .withCoreConfig()
    .create(fsBaseUrl, {
      importer: (filePath) => {
        if (filePath.startsWith('./') || filePath.startsWith('../')) {
          return import(new URL(filePath, fsBaseUrl).href)
        }

        return import(filePath)
      },
    })

  const app = ignitor.createApp('web')
  await app.init()
  await app.boot()

  return app
}

test.group('Configure', (group) => {
  group.each.setup(({ context }) => {
    context.fs.baseUrl = BASE_URL
    context.fs.basePath = fileURLToPath(BASE_URL)
  })

  group.each.disableTimeout()

  test('configure the package with pre-defined drivers', async ({ fs, assert }) => {
    const app = await createApp(fs.baseUrl)

    await fs.create('.env', '')
    await fs.createJson('tsconfig.json', {})
    /**
     * The package.json file keeps the "installPackages" codemod contained
     * inside the temporary directory, instead of letting the package manager
     * walk up to this repository
     */
    await fs.createJson('package.json', { name: 'sms-test-app', type: 'module' })
    await fs.create('start/env.ts', `export default Env.create(new URL('./'), {})`)
    await fs.create('adonisrc.ts', `export default defineConfig({})`)

    const ace = await app.container.make('ace')
    const command = await ace.create(Configure, [
      '../../index.js',
      '--drivers=twilio',
      '--drivers=vonage',
    ])
    await command.exec()

    await assert.fileExists('config/sms.ts')
    await assert.fileContains('config/sms.ts', 'defineConfig')
    await assert.fileContains('config/sms.ts', 'drivers.twilio(')
    await assert.fileContains('config/sms.ts', 'drivers.vonage(')
    await assert.fileNotContains('config/sms.ts', 'drivers.sns(')

    await assert.fileContains('adonisrc.ts', '@artian-techs/adonis-sms/sms_provider')
    await assert.fileContains('adonisrc.ts', '@artian-techs/adonis-sms/commands')

    await assert.fileContains('.env', 'TWILIO_ACCOUNT_SID')
    await assert.fileContains('.env', 'VONAGE_API_KEY')
    await assert.fileContains('start/env.ts', 'TWILIO_ACCOUNT_SID: Env.schema.string()')
  })

  test('fail when an unknown driver is selected', async ({ fs, assert }) => {
    const app = await createApp(fs.baseUrl)

    await fs.create('.env', '')
    await fs.createJson('tsconfig.json', {})
    /**
     * The package.json file keeps the "installPackages" codemod contained
     * inside the temporary directory, instead of letting the package manager
     * walk up to this repository
     */
    await fs.createJson('package.json', { name: 'sms-test-app', type: 'module' })
    await fs.create('start/env.ts', `export default Env.create(new URL('./'), {})`)
    await fs.create('adonisrc.ts', `export default defineConfig({})`)

    const ace = await app.container.make('ace')
    ace.ui.switchMode('raw')

    const command = await ace.create(Configure, ['../../index.js', '--drivers=foo'])
    await command.exec()

    assert.equal(command.exitCode, 1)
    command.assertLogMatches(/Invalid driver "foo"/)
  })
})
