import type {
  MessageNode,
  ManyMessagesNode,
  InfobipDriverConfig,
  InfobipMessageResponse,
  InfobipResponse,
  InfobipRuntimeOptions,
} from '../types.js'

import { ObjectBuilder } from '@poppinss/utils'
import string from '@poppinss/utils/string'

import { ContentType, InfobipAuthType } from '../enums.js'
import { BaseDriver } from './base_driver.js'
import { SmsResponse } from '../sms_response.js'

/**
 * Driver for the Infobip SMS API
 *
 * @see https://www.infobip.com/docs/api/channels/sms/sms-messaging/outbound-sms/send-sms-message
 */
export class InfobipDriver extends BaseDriver {
  #infobip?: any

  constructor(protected config: InfobipDriverConfig) {
    super(config)
  }

  /**
   * Lazily creates the Infobip client. The SDK is an optional peer
   * dependency, hence it is imported on demand
   */
  protected async getClient() {
    if (this.#infobip) {
      return this.#infobip
    }

    const { Infobip } = await import('@infobip-api/sdk')

    /**
     * The SDK rejects a client without an "authType", so it is inferred from
     * the credentials when the config does not spell it out
     */
    const authType =
      this.config.authType ??
      (this.config.username && this.config.password
        ? InfobipAuthType.Basic
        : InfobipAuthType.ApiKey)

    const options = new ObjectBuilder({}, true)
      .add('baseUrl', this.config.baseUrl)
      .add('apiKey', this.config.apiKey)
      .add('authType', authType)

    if (authType === InfobipAuthType.Basic) {
      options.add('username', this.config.username)
      options.add('password', this.config.password)
    }

    this.#infobip = new Infobip(options.toObject() as any)

    return this.#infobip
  }

  /**
   * Send one message to one recipient
   */
  async send(
    sms: MessageNode,
    runtimeOptions?: InfobipRuntimeOptions
  ): Promise<SmsResponse<InfobipMessageResponse>> {
    const responses = await this.#sendSms(this.#prepare({ ...sms, to: [sms.to] }, runtimeOptions))

    return responses[0]
  }

  /**
   * Send the exact same message to multiple recipients
   */
  async sendMany(
    sms: ManyMessagesNode,
    runtimeOptions?: InfobipRuntimeOptions
  ): Promise<SmsResponse<InfobipMessageResponse>[]> {
    return this.#sendSms(this.#prepare(sms, runtimeOptions))
  }

  #prepare(sms: ManyMessagesNode, runtimeOptions?: InfobipRuntimeOptions) {
    const webhook = runtimeOptions?.webhook ?? this.config.webhook
    const webhookContentType = runtimeOptions?.webhookContentType ?? this.config.webhookContentType
    const bulkId = sms.to.length > 1 ? (runtimeOptions?.bulkId ?? string.random(32)) : null
    const sendingSpeedLimit = runtimeOptions?.sendingSpeedLimit ?? this.config.sendingSpeedLimit

    return new ObjectBuilder({}, true)
      .add(
        'destinations',
        sms.to.map((recipient) => ({ to: recipient.replace('+', '') }))
      )
      .add('from', sms.from.replace('+', ''))
      .add('text', sms.message)
      .add('notifyUrl', webhook)
      .add('notifyContentType', webhook ? (webhookContentType ?? ContentType.JSON) : null)
      .add('sendAt', runtimeOptions?.sendAt ? runtimeOptions.sendAt.toISOString() : null)
      .add('flash', runtimeOptions?.flash ?? this.config.flash ?? false)
      .add('callbackData', runtimeOptions?.callbackData)
      .add('bulkId', bulkId)
      .add('sendingSpeedLimit', sendingSpeedLimit)
      .add(
        'intermediateReport',
        runtimeOptions?.intermediateReport ?? this.config.intermediateReport
      )
      .toObject()
  }

  /**
   * Infobip answers with one entry per destination, so every entry becomes
   * its own response carrying that entry as "original".
   *
   * The "bulkId" only exists on the enclosing response, yet it is what
   * identifies the batch when fetching delivery reports, so it is copied
   * onto every entry rather than being dropped
   */
  async #sendSms(sms: any): Promise<SmsResponse<InfobipMessageResponse>[]> {
    const infobip = await this.getClient()
    const response = await infobip.channels.sms.send({ messages: [sms] })
    const data: InfobipResponse = response.data

    return (data.messages ?? []).map(
      (message) =>
        new SmsResponse(message.messageId ?? '', {
          ...message,
          ...(data.bulkId ? { bulkId: data.bulkId } : {}),
        })
    )
  }
}
