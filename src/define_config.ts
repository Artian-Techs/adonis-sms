import { configProvider } from '@adonisjs/core'
import type { ConfigProvider } from '@adonisjs/core/types'

import type { SNSDriver } from './drivers/sns.js'
import type { TwilioDriver } from './drivers/twilio.js'
import type { VonageDriver } from './drivers/vonage.js'
import type { InfobipDriver } from './drivers/infobip.js'
import type {
  SmsDriverFactory,
  SmsConfig,
  SNSDriverConfig,
  TwilioDriverConfig,
  VonageDriverConfig,
  InfobipDriverConfig,
} from './types.js'

/**
 * Helper to remap the known clients to factory functions
 */
type ResolvedConfig<KnownClients extends Record<string, SmsDriverFactory>> = SmsConfig & {
  default?: keyof KnownClients
  clients: {
    [K in keyof KnownClients]: KnownClients[K] extends ConfigProvider<infer A> ? A : KnownClients[K]
  }
}

/**
 * Helper function to define the config for the sms service
 */
export function defineConfig<KnownClients extends Record<string, SmsDriverFactory>>(
  config: SmsConfig & {
    default?: keyof KnownClients
    clients: {
      [K in keyof KnownClients]: ConfigProvider<KnownClients[K]> | KnownClients[K]
    }
  }
): ConfigProvider<ResolvedConfig<KnownClients>> {
  return configProvider.create(async (app) => {
    const { clients, default: defaultClient, ...rest } = config
    const clientsNames = Object.keys(clients)
    const drivers = {} as Record<string, SmsDriverFactory>

    for (let clientName of clientsNames) {
      const clientDriver = clients[clientName]

      if (typeof clientDriver === 'function') {
        drivers[clientName] = clientDriver
      } else {
        drivers[clientName] = await clientDriver.resolver(app)
      }
    }

    return {
      default: defaultClient,
      clients: drivers,
      ...rest,
    } as ResolvedConfig<KnownClients>
  })
}

/**
 * Config helpers to create a reference for the inbuilt sms drivers
 */
export const drivers: {
  sns: (config: SNSDriverConfig) => ConfigProvider<() => SNSDriver>
  twilio: (config: TwilioDriverConfig) => ConfigProvider<() => TwilioDriver>
  vonage: (config: VonageDriverConfig) => ConfigProvider<() => VonageDriver>
  infobip: (config: InfobipDriverConfig) => ConfigProvider<() => InfobipDriver>
} = {
  sns(config) {
    return configProvider.create(async () => {
      const { SNSDriver } = await import('./drivers/sns.js')

      return () => new SNSDriver(config)
    })
  },
  twilio(config) {
    return configProvider.create(async () => {
      const { TwilioDriver } = await import('./drivers/twilio.js')

      return () => new TwilioDriver(config)
    })
  },
  vonage(config) {
    return configProvider.create(async () => {
      const { VonageDriver } = await import('./drivers/vonage.js')

      return () => new VonageDriver(config)
    })
  },
  infobip(config) {
    return configProvider.create(async () => {
      const { InfobipDriver } = await import('./drivers/infobip.js')

      return () => new InfobipDriver(config)
    })
  },
}
