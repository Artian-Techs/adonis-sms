import { configProvider } from '@adonisjs/core'
import { RuntimeException } from '@poppinss/utils'
import type { ApplicationService } from '@adonisjs/core/types'

import { SmsManager, SmsClient } from '../index.js'
import type { SmsEvents, SmsService } from '../src/types.js'

/**
 * Extended types
 */
declare module '@adonisjs/core/types' {
  export interface ContainerBindings {
    'sms.manager': SmsService
  }
  export interface EventsList extends SmsEvents {}
}

/**
 * Sms provider to register the sms manager with the container
 */
export default class SmsProvider {
  constructor(protected app: ApplicationService) {}

  /**
   * Registering bindings to the container
   */
  register() {
    this.app.container.singleton('sms.manager', async (resolver) => {
      const emitter = await resolver.make('emitter')
      const smsConfigProvider = this.app.config.get('sms')
      const config = await configProvider.resolve<any>(this.app, smsConfigProvider)

      if (!config) {
        throw new RuntimeException(
          'Invalid "config/sms.ts" file. Make sure you are using the "defineConfig" method'
        )
      }

      return new SmsManager(emitter, config)
    })

    this.app.container.bind(SmsClient, async (resolver) => {
      const smsManager = await resolver.make('sms.manager')

      return smsManager.use()
    })
  }
}
