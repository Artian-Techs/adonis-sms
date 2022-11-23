import type { MessageNode, VonageDriverConfig, VonageRuntimeOptions } from '@ioc:Adonis/Addons/Sms'

import { default as Vonage, MessageRequestResponse } from '@vonage/server-sdk'
import { ObjectBuilder } from '@poppinss/utils/build/helpers'

import BaseDriver from './BaseDriver'

export default class VonageDriver extends BaseDriver {
  #vonage: Vonage

  constructor(protected config: VonageDriverConfig, public debug = false) {
    super(config)

    const credentials = new ObjectBuilder(true)
    credentials.add('apiKey', this.config.apiKey)
    credentials.add('apiSecret', this.config.apiSecret)
    credentials.add('applicationID', this.config.applicationID)
    credentials.add('privateKey', this.config.privateKey)
    credentials.add('signatureSecret', this.config.signatureSecret)
    credentials.add('signatureMethod', this.config.signatureMethod)

    const options = new ObjectBuilder(true)
    options.add('debug', this.debug)
    options.add('appendToUserAgent', this.config.appendToUserAgent)
    options.add('timeout', this.config.timeout)
    options.add('apiHost', this.config.apiHost)
    options.add('restHost', this.config.restHost)

    /**
     * https://www.npmjs.com/package/@vonage/server-sdk#Constructor
     */
    this.#vonage = new Vonage(credentials.value, options.value)
  }

  /**
   * https://developer.vonage.com/api/sms
   */
  public async send(sms: MessageNode, runtimeOptions?: VonageRuntimeOptions) {
    const smsOptions = new ObjectBuilder(true)

    if (runtimeOptions) {
      Object.entries(runtimeOptions).forEach((option) => {
        const key = option.at(0)

        smsOptions.add(key === 'webhook' ? 'callback' : key, option.at(1))
      })
    }

    if (!smsOptions.has('callback') && this.config.webhook) {
      smsOptions.add('callback', this.config.webhook)
    }

    return Promise.all(
      sms.to.map((recipient) => this.#sendSms(sms.from, recipient, sms.message, smsOptions.value))
    )
  }

  async #sendSms(from: string, to: string, text: string, runtimeOptions?: VonageRuntimeOptions) {
    return new Promise((resolve, reject) => {
      ;(this.#vonage.message as any).sendSms(
        from,
        to,
        text,
        runtimeOptions,
        (err: any, response: MessageRequestResponse) => {
          if (err) {
            reject(err.message)
          } else {
            if (response.messages[0]['status'] === '0') {
              resolve(response)
            } else {
              reject(`${response.messages[0]['error-text']}`)
            }
          }
        }
      )
    })
  }
}
