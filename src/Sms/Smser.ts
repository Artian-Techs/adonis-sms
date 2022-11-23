import type {
  RuntimeOptions,
  Sender,
  MessageComposeCallback,
  BulkMessageComposeCallback,
  SmsersList,
  SmserContract,
  CompiledSmsNode,
  DriverOptionsType,
} from '@ioc:Adonis/Addons/Sms'

import { string } from '@poppinss/utils/build/helpers'

import Message from '../Message/Message'
import BulkMessage from '../Message/BulkMessage'
import SmsManager from './SmsManager'

import InvalidWebhookProtocolException from '../Exceptions/InvalidWebhookProtocolException'
import InvalidWebhookFormatException from '../Exceptions/InvalidWebhookFormatException'
import InvalidPhoneNumberException from '../Exceptions/InvalidPhoneNumberException'
import MissingParameterException from '../Exceptions/MissingParameterException'
import NoSenderProvidedException from '../Exceptions/NoSenderProvidedException'
import MissingMessageException from '../Exceptions/MissingMessageException'

export default class Smser<Name extends keyof SmsersList> implements SmserContract<Name> {
  #runtimeOptions?: RuntimeOptions[Name]

  constructor(
    private manager: SmsManager,
    private useQueue: boolean,
    public name: Name,
    public driver: SmsersList[Name]['implementation']
  ) {}

  /**
   * Send sms for real
   */
  public async sendCompiled(sms: CompiledSmsNode) {
    const response = this.driver.send(sms.message, sms.config)
    const data = {
      message: sms.message,
      smser: sms.smser,
      response,
    }

    /**
     * Emit event on success or failure.
     */
    this.manager.emitter.emit('sms:sent', data)

    return response
  }

  public async sendLater(callback: MessageComposeCallback, config?: any): Promise<any> {
    if (!this.useQueue) {
      await this.send(callback, config)

      return
    }

    const message = new Message()
    await callback(message)

    const compiledMessage = message.toJSON()

    return this.manager.scheduleSms({
      message: compiledMessage,
      smser: this.name,
      config: config || this.#runtimeOptions,
    })
  }

  public async send(callback: MessageComposeCallback, runtimeOptions?: RuntimeOptions[Name]) {
    const sms = new Message()
    callback(sms)

    const compiledSms = sms.toJSON()
    let { from, to, message } = compiledSms

    this.#checkMessage(message)

    if (this.manager.config.removeExtraSpaces) {
      message = this.#removeExtraSpaces(message)
    }

    if (this.manager.config.normalize) {
      message = this.#normalizeMessage(message)
    }

    if (!to) {
      throw MissingParameterException.invoke('to')
    } else {
      this.#checkPhoneNumbers(to)
    }

    let options = (runtimeOptions as any) || {}

    if (this.name !== 'sns') {
      const webhook = this.#getWebhook(options.webhook)

      if (webhook) {
        options.webhook = webhook
      } else {
        if (!runtimeOptions) {
          options = null
        }
      }
    }

    const response = await this.driver.send(
      { ...compiledSms, from: this.#getSender(from)! },
      options
    )

    if (this.driver.debug) {
      console.dir(response, { depth: null })
    }

    return response
  }

  public async sendBulk(callback: BulkMessageComposeCallback): Promise<any> {
    const bulkSms = new BulkMessage()
    callback(bulkSms)

    const compiledSms = bulkSms.toJSON()
    const { from, to } = compiledSms
    let response: any

    this.#checkPhoneNumbers(to.map((item) => item[0]))

    if (typeof this.driver['sendBulk'] === 'function') {
      response = await this.driver.sendBulk(compiledSms)
    } else {
      response = await Promise.all(
        compiledSms.to.map(([recipient, message]) =>
          this.driver.send({ to: [recipient], message, from: this.#getSender(from)! })
        )
      )
    }

    if (this.driver.debug) {
      console.dir(response, { depth: null })
    }

    return response
  }

  /**
   * Check if "from" argument has been provided.
   * If not, use the driver config "from".
   * Otherwise, use the global config "from".
   */
  #getSender(from?: Sender) {
    const sender = from ?? this.driver.getConfig().from ?? this.manager.config.from
    this.#checkSender(sender)

    return sender
  }

  /**
   * Check if "webhook" argument has been provided.
   * If not, use the driver config "webhook".
   * Otherwise, use the global config "webhook".
   */
  #getWebhook(webhook?: string) {
    const webhookUrl = webhook ?? this.driver.getConfig().webhook ?? this.manager.config.webhook

    if (webhookUrl) {
      this.#checkWebhook(webhookUrl)
    }

    return webhookUrl
  }

  /**
   * Remove characters (accents) with their equivalent
   */
  #normalizeMessage(message: string) {
    return message.normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove accents
  }

  /**
   * Replace extra spaces by one space.
   */
  #removeExtraSpaces(message: string) {
    return message.replace(/\s+/g, ' ')
  }

  #checkSender(sender?: Sender) {
    if (!sender) {
      throw NoSenderProvidedException.invoke()
    }
  }

  #checkWebhook(webhook: string) {
    let url: URL

    try {
      url = new URL(webhook)
      const protocol = url.protocol.replace(':', '')

      if (!['http', 'https'].includes(protocol)) {
        throw InvalidWebhookProtocolException.invoke(protocol)
      }
    } catch {
      throw InvalidWebhookFormatException.invoke(webhook)
    }
  }

  #checkPhoneNumbers(phoneNumbers: Array<string>) {
    phoneNumbers.forEach((phoneNumber) => {
      if (!/^\+[1-9]\d{10,14}$/.test(phoneNumber)) {
        throw InvalidPhoneNumberException.invoke(phoneNumber)
      }
    })
  }

  #checkMessage(message?: string) {
    if (!message || string.isEmpty(message)) {
      throw MissingMessageException.invoke()
    }
  }
}
