import type {
  MessageNode,
  ManyMessagesNode,
  VonageDriverConfig,
  VonageResponse,
  VonageRuntimeOptions,
} from '../types.js'

import { ObjectBuilder } from '@poppinss/utils'

import { BaseDriver } from './base_driver.js'
import { SmsResponse } from '../sms_response.js'
import * as errors from '../errors.js'

/**
 * Driver for the Vonage Messages API, which supersedes the legacy SMS API.
 *
 * It authenticates with an application ID and a private key (JWT, recommended
 * by Vonage) or with an API key and secret
 *
 * @see https://developer.vonage.com/en/api/messages
 */
export class VonageDriver extends BaseDriver {
  #vonage: any

  constructor(protected config: VonageDriverConfig) {
    super(config)
  }

  /**
   * Lazily creates the Vonage client. The SDK is an optional peer
   * dependency, hence it is imported on demand
   */
  protected async getClient() {
    if (this.#vonage) {
      return this.#vonage
    }

    const { Vonage } = await import('@vonage/server-sdk')

    /**
     * The Messages API accepts a JWT (preferred) as well as basic auth, so
     * both credential pairs are forwarded when defined
     */
    const credentials = new ObjectBuilder({}, true)
    credentials.add('apiKey', this.config.apiKey)
    credentials.add('apiSecret', this.config.apiSecret)
    credentials.add('applicationId', this.config.applicationId)
    credentials.add('privateKey', this.config.privateKey)

    const options = new ObjectBuilder({}, true)
    options.add('appendUserAgent', this.config.appendToUserAgent)
    options.add('timeout', this.config.timeout)
    options.add('apiHost', this.config.apiHost)

    this.#vonage = new Vonage(credentials.toObject() as any, options.toObject() as any)

    return this.#vonage
  }

  /**
   * Send one message to one recipient
   */
  async send(
    { from, to, message }: MessageNode,
    runtimeOptions?: VonageRuntimeOptions
  ): Promise<SmsResponse<VonageResponse>> {
    return this.#sendSms(from, to, message, runtimeOptions)
  }

  /**
   * Send the exact same message to multiple recipients. The Messages API
   * handles one recipient per request, so the driver fans out
   */
  async sendMany(
    sms: ManyMessagesNode,
    runtimeOptions?: VonageRuntimeOptions
  ): Promise<SmsResponse<VonageResponse>[]> {
    return this.fanOut(sms.to, (recipient) =>
      this.#sendSms(sms.from, recipient, sms.message, runtimeOptions)
    )
  }

  async #sendSms(
    from: string,
    to: string,
    text: string,
    runtimeOptions?: VonageRuntimeOptions
  ): Promise<SmsResponse<VonageResponse>> {
    const vonage = await this.getClient()

    const payload = new ObjectBuilder<Record<string, any>, true>({}, true)
      .add('channel', 'sms')
      .add('messageType', 'text')
      .add('from', from)
      .add('to', to)
      .add('text', text)
      .add('ttl', runtimeOptions?.ttl)
      .add('clientRef', runtimeOptions?.clientRef)
      .add('trustedRecipient', runtimeOptions?.trustedRecipient)
      .add('webhookVersion', runtimeOptions?.webhookVersion)

    /**
     * The webhook is resolved by the client and mapped to the param name
     * used by the Messages API
     */
    const webhook = runtimeOptions?.webhook ?? this.config.webhook
    if (webhook) {
      payload.add('webhookUrl', webhook)
    }

    const sms = new ObjectBuilder<Record<string, any>, true>({}, true)
      .add('encodingType', runtimeOptions?.encodingType ?? this.config.encodingType)
      .add('contentId', runtimeOptions?.contentId ?? this.config.contentId)
      .add('entityId', runtimeOptions?.entityId ?? this.config.entityId)
      .toObject()

    if (Object.keys(sms).length) {
      payload.add('sms', sms)
    }

    try {
      const response: VonageResponse = await vonage.messages.send(payload.toObject())

      return new SmsResponse(response.messageUUID, response)
    } catch (error) {
      /**
       * Unlike the legacy SMS API, the Messages API answers with a proper
       * HTTP error. The SDK surfaces the RFC 7807 body, whose "title" and
       * "detail" carry the actual reason
       */
      const body = error?.response?.data ?? error?.response

      if (body?.title || body?.detail) {
        throw new errors.E_SMS_DRIVER_ERROR([[body.title, body.detail].filter(Boolean).join(' - ')])
      }

      throw error
    }
  }
}
