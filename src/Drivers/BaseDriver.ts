import type {
  SmsDriverContract,
  DriverConfig,
  MessageNode,
  BulkMessageNode,
} from '@ioc:Adonis/Addons/Sms'

import Request from '../Request'

export default abstract class BaseDriver implements SmsDriverContract {
  public debug: boolean

  protected request: Request

  constructor(protected $config: DriverConfig, protected url?: string, protected method = 'POST') {
    if (this.url) {
      this.request = new Request(this.url, method)
    }
  }

  public abstract send(sms: MessageNode, runtimeOptions: any): Promise<any>

  public sendBulk?(bulkMessageNode: BulkMessageNode, driverRuntimeConfig?: any): Promise<any>

  public getConfig() {
    return this.$config
  }
}
