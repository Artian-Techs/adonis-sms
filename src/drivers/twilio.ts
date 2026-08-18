import type { Twilio } from 'twilio'
import type {
  MessageNode,
  ManyMessagesNode,
  TwilioDriverConfig,
  TwilioResponse,
  TwilioRuntimeOptions,
} from '../types.js'

import { ObjectBuilder } from '@poppinss/utils'

import { BaseDriver } from './base_driver.js'
import { SmsResponse } from '../sms_response.js'

/**
 * Config keys consumed by the Twilio client itself and therefore never
 * forwarded to the "messages.create" call
 */
const CLIENT_ONLY_OPTIONS = [
  'logLevel',
  'region',
  'edge',
  'lazyLoading',
  'userAgentExtensions',
  'from',
  'webhook',
]

/**
 * Driver for the Twilio Programmable Messaging API
 *
 * @see https://www.twilio.com/docs/sms/send-messages
 */
export class TwilioDriver extends BaseDriver {
  #twilio?: Twilio

  constructor(protected config: TwilioDriverConfig) {
    super(config)
  }

  /**
   * Lazily creates the Twilio SDK instance. The SDK is an optional peer
   * dependency, hence it is imported on demand
   */
  protected async getSdk(): Promise<Twilio> {
    if (this.#twilio) {
      return this.#twilio
    }

    /**
     * The Twilio SDK is CommonJS and exposes "Twilio" on its "module.exports"
     * object only. Node cannot detect it as a named export, so it has to be
     * read from the default export
     */
    const twilioModule = await import('twilio')
    const TwilioClient = (twilioModule.default as any)?.Twilio ?? (twilioModule as any).Twilio

    const clientOptions = new ObjectBuilder({}, true)
      .add('region', this.config.region)
      .add('edge', this.config.edge)
      .add('lazyLoading', this.config.lazyLoading)
      .add('userAgentExtensions', this.config.userAgentExtensions)

    const client: Twilio = new TwilioClient(
      this.config.accountSid,
      this.config.authToken,
      clientOptions.toObject() as any
    )
    this.#twilio = client

    return client
  }

  /**
   * Send one message to one recipient
   */
  async send(
    { from, to, message }: MessageNode,
    runtimeOptions?: TwilioRuntimeOptions
  ): Promise<SmsResponse<TwilioResponse>> {
    const twilio = await this.getSdk()
    const options = this.#prepare(runtimeOptions)
    const response = await twilio.messages.create({ ...options, body: message, to, from })

    return new SmsResponse(response.sid, response)
  }

  /**
   * Send the exact same message to multiple recipients
   */
  async sendMany(
    { from, to, message }: ManyMessagesNode,
    runtimeOptions?: TwilioRuntimeOptions
  ): Promise<SmsResponse<TwilioResponse>[]> {
    return this.fanOut(to, (recipient) =>
      this.send({ from, to: recipient, message }, runtimeOptions)
    )
  }

  /**
   * Merges the driver config with the runtime options. The "webhook" option
   * is mapped to the "statusCallback" param
   */
  #prepare(runtimeOptions?: TwilioRuntimeOptions) {
    const smsOptions = new ObjectBuilder<Record<string, any>, true>({}, true)

    Object.entries(this.config).forEach(([key, value]) => {
      if (!CLIENT_ONLY_OPTIONS.includes(key) && key !== 'accountSid' && key !== 'authToken') {
        smsOptions.add(key, value)
      }
    })

    if (runtimeOptions) {
      Object.entries(runtimeOptions).forEach(([key, value]) => {
        smsOptions.add(key === 'webhook' ? 'statusCallback' : key, value)
      })
    }

    if (!smsOptions.has('statusCallback') && this.config.webhook) {
      smsOptions.add('statusCallback', this.config.webhook)
    }

    return smsOptions.toObject() as Record<string, any>
  }
}
