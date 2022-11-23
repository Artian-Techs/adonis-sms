import type {
  MessageNode,
  InfobipDriverConfig,
  InfobipRuntimeOptions,
} from '@ioc:Adonis/Addons/Sms'

import { ObjectBuilder, string } from '@poppinss/utils/build/helpers'
import { Infobip } from '@infobip-api/sdk'

import InfobipAuthType from '../Enums/InfobipAuthType'
import ContentType from '../Enums/ContentType'
import BaseDriver from './BaseDriver'

export default class InfobipDriver extends BaseDriver {
  constructor(private config: InfobipDriverConfig, public debug = false) {
    super(config)
  }

  // https://www.infobip.com/docs/api/channels/sms/sms-messaging/outbound-sms/send-sms-message
  public async send(sms: MessageNode, runtimeOptions?: InfobipRuntimeOptions) {
    return await this.#sendSms(this.#constructSms(sms, runtimeOptions))
  }

  #constructSms(sms: MessageNode, runtimeOptions?: InfobipRuntimeOptions) {
    const webhook = runtimeOptions?.webhook ?? this.config.webhook
    const webhookContentType = runtimeOptions?.webhookContentType ?? this.config.webhookContentType
    const bulkId = sms.to.length > 1 ? runtimeOptions?.bulkId ?? string.generateRandom(32) : null
    const sendingSpeedLimit = runtimeOptions?.sendingSpeedLimit ?? this.config.sendingSpeedLimit

    return new ObjectBuilder(true)
      .add(
        'destinations',
        sms.to.map((recipient: string) => {
          return {
            to: recipient.replace('+', ''),
          }
        })
      )
      .add('from', sms.from.replace('+', ''))
      .add('text', sms.message)
      .add('notifyUrl', webhook)
      .add('notifyContentType', webhook ? webhookContentType ?? ContentType.JSON : null)
      .add('sendAt', runtimeOptions?.sendAt ? runtimeOptions.sendAt.toISOString() : null)
      .add('flash', runtimeOptions?.flash ?? false)
      .add('callbackData', runtimeOptions?.callbackData)
      .add('bulkId', bulkId)
      .add('sendingSpeedLimit', sendingSpeedLimit)
      .add(
        'intermediateReport',
        runtimeOptions?.intermediateReport ?? this.config.intermediateReport
      ).value
  }

  async #sendSms(sms: any) {
    const options = new ObjectBuilder(true)
      .add('baseUrl', this.config.baseURL)
      .add('apiKey', this.config.apiKey)
      .add('authType', this.config.authType)

    if (this.config.authType === InfobipAuthType.Basic) {
      options.add('username', this.config.username)
      options.add('password', this.config.password)
    }

    const infobip = new Infobip(options.value)

    return (
      await infobip.channels.sms.send({
        messages: [sms],
      })
    ).data
  }
}
