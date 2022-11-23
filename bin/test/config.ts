import type { AppEnvironments } from '@ioc:Adonis/Core/Application'

import { join } from 'node:path'

import { Filesystem } from '@poppinss/dev-utils'
import { Application } from '@adonisjs/core/build/standalone'

import smsConfig from '../../tests/config/sms'

export const fs = new Filesystem(join(__dirname, 'app'))

export async function setup(environment: AppEnvironments = 'test') {
  await fs.add('.env', '')
  await fs.add(
    'config/app.ts',
    `
		export const appKey = 'averylong32charsrandomsecretkey',
		export const http = {
			cookie: {},
			trustProxy: () => true,
		}
	`
  )

  await fs.add(
    'config/sms.ts',
    `
    const smsConfig = ${JSON.stringify(smsConfig, null, 2)}
    export default smsConfig
  `
  )

  const app = new Application(fs.basePath, environment, {
    providers: ['@adonisjs/core', '@adonisjs/repl', '../../../providers/SmsProvider'],
  })

  await app.setup()
  await app.registerProviders()
  await app.bootProviders()

  return app
}
