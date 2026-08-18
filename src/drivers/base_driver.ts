import type {
  SmsDriverConfig,
  SmsDriverContract,
  MessageNode,
  ManyMessagesNode,
  BulkMessageNode,
} from '../types.js'

import { SmsResponse } from '../sms_response.js'
import { DEFAULT_CONCURRENCY, mapWithConcurrency } from '../utils.js'

export abstract class BaseDriver implements SmsDriverContract {
  /**
   * Indicates whether the driver accepts a webhook URL or not
   */
  acceptWebhook = true

  constructor(protected driverConfig: SmsDriverConfig) {}

  abstract send(sms: MessageNode, runtimeOptions?: any): Promise<SmsResponse<any>>

  abstract sendMany(sms: ManyMessagesNode, runtimeOptions?: any): Promise<SmsResponse<any>[]>

  sendBulk?(bulkMessage: BulkMessageNode, runtimeOptions?: any): Promise<SmsResponse<any>[]>

  getConfig() {
    return this.driverConfig
  }

  /**
   * Fans out over the recipients while keeping the number of in-flight
   * requests bounded
   */
  protected fanOut<Item, Result>(
    items: Item[],
    mapper: (item: Item) => Promise<Result>
  ): Promise<Result[]> {
    return mapWithConcurrency(items, this.driverConfig.concurrency ?? DEFAULT_CONCURRENCY, (item) =>
      mapper(item)
    )
  }
}
