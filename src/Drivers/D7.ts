import type {
  MessageNode,
  BulkMessageNode,
  D7DriverConfig,
  D7RuntimeOptions,
} from '@ioc:Adonis/Addons/Sms'

import BaseDriver from './BaseDriver'

export default class D7Driver extends BaseDriver {
  #commonProperties = {
    channel: 'sms',
    msg_type: 'text',
  }

  constructor(private config: D7DriverConfig, public debug = false) {
    super(config, config.baseUrl)
  }

  /**
   * https://d7networks.com/docs/Messages/Send_Message
   */
  public async send(message: MessageNode, runtimeOptions?: D7RuntimeOptions): Promise<any> {
    const messages = [
      {
        ...this.#commonProperties,
        recipients: message.to,
        content: message.message,
        data_coding: this.#getDataCoding(runtimeOptions),
      },
    ]

    return await this.#sendRequest(
      messages,
      message.from,
      runtimeOptions?.webhook ?? this.config.webhook
    )
  }

  public async sendBulk(
    bulkMessage: BulkMessageNode,
    runtimeOptions?: D7RuntimeOptions
  ): Promise<any> {
    const messages: Array<any> = []

    bulkMessage.to.forEach((recipient) =>
      messages.push({
        ...this.#commonProperties,
        recipients: [recipient[0]],
        content: recipient[1],
        data_coding: this.#getDataCoding(runtimeOptions),
      })
    )

    return await this.#sendRequest(
      messages,
      bulkMessage.from,
      runtimeOptions?.webhook ?? this.config.webhook
    )
  }

  async #sendRequest(messages: Array<Record<string, any>>, from: string, webhook?: string) {
    return await this.request
      .headers({
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${this.config.apiToken}`,
      })
      .body(
        JSON.stringify({
          messages,
          message_globals: {
            originator: from,
            ...(webhook ? { report_url: webhook } : {}),
          },
        })
      )
      .send()
  }

  #getDataCoding(runtimeOptions?: D7RuntimeOptions) {
    return runtimeOptions?.webhook ?? this.config.dataCoding ?? 'text'
  }
}
