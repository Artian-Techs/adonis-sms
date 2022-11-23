import type { InferSmsersFromConfig } from '../config'

import smsConfig from './config/sms'

declare module '@ioc:Adonis/Addons/Sms' {
  export interface SmsersList extends InferSmsersFromConfig<typeof smsConfig> {}

  interface InferSelectedSmserFromConfig {
    smser: typeof import('../tests/config/sms').default['smser']
  }
}
