import type { SmsAPIDriverConfig, MessageNode, SmsAPIRuntimeOptions } from '@ioc:Adonis/Addons/Sms'

import { SMSAPI } from 'smsapi'
import { ObjectBuilder } from '@poppinss/utils/build/helpers'

import BaseDriver from './BaseDriver'

export default class SmsAPIDriver extends BaseDriver {
  #smsapi: SMSAPI

  constructor(private config: SmsAPIDriverConfig, public debug = false) {
    super(config)

    this.#smsapi = new SMSAPI(this.config.accessToken)
  }

  /**
   * https://www.smsapi.com/docs#2-single-sms
   */
  public async send(sms: MessageNode, runtimeOptions: SmsAPIRuntimeOptions): Promise<any> {
    const isTestSms = Number(this.config.test ?? runtimeOptions.test)

    const options = new ObjectBuilder(true)
    options.add('from', sms.from)
    options.add('test', isNaN(isTestSms) ? undefined : isTestSms)

    if (runtimeOptions) {
      Object.entries(runtimeOptions).forEach((option: [string, string]) => {
        const propertyName = option.at(0)!

        options.add(propertyName === 'webhook' ? 'notify_url' : propertyName, option.at(1)!)
      })
    }

    if (!options.has('notify_url') && this.config.webhook) {
      options.add('notify_url', this.config.webhook)
    }

    await this.#smsapi.sms.sendSms(sms.to, sms.message, options.value)
  }
}
