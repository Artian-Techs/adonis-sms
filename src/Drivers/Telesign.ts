import type {
  MessageNode,
  TelesignDriverConfig,
  TelesignRuntimeOptions,
} from '@ioc:Adonis/Addons/Sms'

import { string } from '@poppinss/utils/build/helpers'

import TelesignBatchUCID from '../Enums/TelesignBatchUCID'
import TelesignClientType from '../Enums/TelesignClientType'

import BaseDriver from './BaseDriver'
import Request from '../Request'

export default class TelesignDriver extends BaseDriver {
  #batchRequest: Request

  constructor(private config: TelesignDriverConfig, public debug = false) {
    super(config, 'https://rest-api.telesign.com/v1/messaging')

    const token = Buffer.from(`${this.config.customerId}:${this.config.apiKey}`)
    const headers = {
      'Authorization': `Basic ${token.toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    }

    this.request.headers(headers)

    this.#batchRequest = new Request('https://rest-ww.telesign.com/v1/verify/bulk_sms')
    this.#batchRequest.headers(headers)
  }

  /**
   * https://developer.telesign.com/enterprise/reference/sendsms
   * https://developer.telesign.com/enterprise/reference/sendbulksms
   * Send the same Sms to one or many recipients.
   */
  public async send(sms: MessageNode, runtimeOptions?: TelesignRuntimeOptions) {
    const recipients = sms.to

    if (recipients.length > 1) {
      /**
       * Multiple recipients.
       * If client type = Entreprise -> use the bulk service from Telesign.
       * Otherwise send multiple requests.
       */
      if (this.config.type === TelesignClientType.Entreprise) {
        return await this.#sendBatchRequest(recipients, sms.message, sms.from, runtimeOptions)
      } else {
        return Promise.all(
          sms.to.map((recipient) =>
            this.#sendRequest(recipient, sms.message, sms.from, runtimeOptions)
          )
        )
      }
    } else {
      // One recipient.
      return this.#sendRequest(recipients.at(0)!, sms.message, sms.from, runtimeOptions)
    }
  }

  async #sendRequest(
    to: string,
    message: string,
    from: string,
    runtimeOptions?: TelesignRuntimeOptions
  ) {
    const body = new URLSearchParams()
    body.append('phone_number', to.replace('+', ''))
    body.append('message', message)
    body.append('sender_id', from)
    body.append('message_type', this.config.messageType)

    if (runtimeOptions) {
      Object.entries(runtimeOptions).forEach((option: [string, string]) => {
        const propertyName = option.at(0)!

        body.append(propertyName === 'webhook' ? 'callback_url' : propertyName, option.at(1)!)
      })
    }

    if (!body.has('callback_url') && this.config.webhook) {
      body.append('callback_url', this.config.webhook)
    }

    return await this.request.body(body.toString()).send()
  }

  async #sendBatchRequest(
    recipients: Array<string>,
    message: string,
    from: string,
    runtimeOptions?: TelesignRuntimeOptions
  ) {
    const body = new URLSearchParams()
    body.append('recipients', recipients.map((to: string) => to.replace('+', '')).join(','))
    body.append('template', message)
    body.append('sender_id', from)
    body.append('ucid', this.config.ucid ?? TelesignBatchUCID.OTHR)

    if (runtimeOptions) {
      Object.entries(runtimeOptions).forEach((option: [string, string]) => {
        const propertyName = string.snakeCase(option.at(0)!)

        body.append(propertyName === 'webhook' ? 'callback_url' : propertyName, option.at(1)!)
      })
    }

    if (!body.has('callback_url') && this.config.webhook) {
      body.append('callback_url', this.config.webhook)
    }

    return await this.#batchRequest.body(body.toString()).send()
  }
}
