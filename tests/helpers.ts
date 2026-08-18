import { AppFactory } from '@adonisjs/core/factories/app'
import { EmitterFactory } from '@adonisjs/core/factories/events'
import type { ApplicationService } from '@adonisjs/core/types'

import { BaseDriver } from '../src/drivers/base_driver.js'
import { SmsResponse } from '../src/sms_response.js'
import type {
  BulkMessageNode,
  ManyMessagesNode,
  MessageNode,
  SmsDriverConfig,
  SmsEvents,
} from '../src/types.js'

export const BASE_URL = new URL('./tmp/', import.meta.url)

/**
 * Creates an emitter instance to inspect the events emitted
 * by the package
 */
export function createEmitter() {
  const app = new AppFactory().create(BASE_URL, () => {}) as ApplicationService

  return new EmitterFactory().create(app) as unknown as import('@adonisjs/core/events').Emitter<
    SmsEvents & Record<string | number | symbol, any>
  >
}

/**
 * An in-memory driver that records every call made to it
 */
export class FakeDriver extends BaseDriver {
  sent: Array<{ method: string; message: any; config?: any }> = []

  constructor(
    config: SmsDriverConfig = {},
    public options: { acceptWebhook?: boolean; withBulk?: boolean } = {}
  ) {
    super(config)

    this.acceptWebhook = options.acceptWebhook ?? true

    if (options.withBulk) {
      this.sendBulk = async (message: BulkMessageNode, sendConfig?: any) => {
        this.sent.push({ method: 'sendBulk', message, config: sendConfig })

        return [new SmsResponse('bulk-id', { id: 'bulk' })]
      }
    }
  }

  async send(message: MessageNode, config?: any) {
    this.sent.push({ method: 'send', message, config })

    return new SmsResponse('send-id', { id: 'send' })
  }

  async sendMany(message: ManyMessagesNode, config?: any) {
    this.sent.push({ method: 'sendMany', message, config })

    return [new SmsResponse('send-many-id', { id: 'sendMany' })]
  }
}

/**
 * A driver that always fails. Used to assert the error handling
 * of the in-memory queue
 */
export class FailingDriver extends BaseDriver {
  async send(): Promise<never> {
    throw new Error('Unable to deliver the sms')
  }

  async sendMany(): Promise<never> {
    throw new Error('Unable to deliver the sms')
  }
}

/**
 * Waits for the next tick(s) so the in-memory queue can flush
 */
export function sleep(ms: number = 10) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
