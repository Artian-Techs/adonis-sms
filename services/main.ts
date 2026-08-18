import app from '@adonisjs/core/services/app'
import type { SmsService } from '../src/types.js'

let sms: SmsService

/**
 * Returns a singleton instance of the SmsManager class from the
 * container
 */
await app.booted(async () => {
  sms = await app.container.make('sms.manager')
})

export { sms as default }
