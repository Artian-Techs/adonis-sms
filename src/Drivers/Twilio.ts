import type { TwilioDriverConfig, MessageNode, TwilioRuntimeOptions } from '@ioc:Adonis/Addons/Sms'

import { ObjectBuilder } from '@poppinss/utils/build/helpers'
import { Twilio } from 'twilio'

import BaseDriver from './BaseDriver'

export default class TwilioDriver extends BaseDriver {
  #twilio: Twilio
  #options: any

  constructor(private config: TwilioDriverConfig, public debug = false) {
    super(config)

    this.#options = new ObjectBuilder(true)
      .add('logLevel', this.debug ? 'debug' : null)
      .add('region', this.config.region)
      .add('edge', this.config.edge)
      .add('lazyLoading', this.config.lazyLoading)
      .add('userAgentExtensions', this.config.userAgentExtensions)
  }

  /**
   * https://www.twilio.com/docs/sms/send-messages
   */
  public async send(smsNode: MessageNode, runtimeOptions?: TwilioRuntimeOptions): Promise<any> {
    this.#twilio = new Twilio(this.config.accountSid, this.config.authToken, this.#options.value)
    const smsOptions = new ObjectBuilder(true)

    Object.entries(this.config).forEach((option: [string, any]) => {
      const key = option.at(0)

      if (
        !['logLevel', 'region', 'edge', 'lazyLoading', 'userAgentExtensions', 'from'].includes(key)
      ) {
        smsOptions.add(key, option.at(1))
      }
    })

    if (runtimeOptions) {
      Object.entries(runtimeOptions).forEach((option: [string, any]) => {
        const key = option.at(0)

        smsOptions.add(key === 'webhook' ? 'statusCallback' : key, option.at(1))
      })
    }

    if (!smsOptions.has('statusCallback') && this.config.webhook) {
      smsOptions.add('statusCallback', this.config.webhook)
    }

    smsOptions.add('body', smsNode.message).add('to', smsNode.to).add('from', smsNode.from)

    return await this.#twilio.messages.create(smsOptions.value)
  }
}
