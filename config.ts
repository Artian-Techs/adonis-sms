import { SmsDrivers } from '@ioc:Adonis/Addons/Sms'

/**
 * Expected shape of the config accepted by the "smsConfig"
 * method
 */
export type SmsConfig = {
  smsers: {
    [name: string]: {
      [K in keyof SmsDrivers]: SmsDrivers[K]['config'] & {
        driver: K
        from?: string
        webhook?: string
      }
    }[keyof SmsDrivers]
  }
  removeExtraSpaces: boolean
  normalize?: boolean
  debug?: boolean
  from?: string
  webhook?: string
}

/**
 * Define config for sms
 */
export function smsConfig<T extends SmsConfig & { smser: keyof T['smsers'] }>(config: T): T {
  return config
}

/**
 * Pull drivers from the config defined inside the "config/sms.ts"
 * file
 */
export type InferSmsersFromConfig<T extends SmsConfig> = {
  [K in keyof T['smsers']]: SmsDrivers[T['smsers'][K]['driver']]
}
