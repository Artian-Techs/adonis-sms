import type { EmitterLike } from '@adonisjs/core/types/events'
import type {
  BulkMessageComposeCallback,
  CompiledSmsNode,
  ManyMessagesComposeCallback,
  MessageComposeCallback,
  SmsDriverContract,
  SmsEvents,
  SmsConfig,
  SmsMessenger,
} from './types.js'

import { debug } from './debug.js'
import * as errors from './errors.js'
import { Message } from './message/message.js'
import { BulkMessage } from './message/bulk_message.js'
import { ManyMessages } from './message/many_messages.js'
import { MemoryQueueMessenger } from './messengers/memory_queue.js'
import {
  DEFAULT_CONCURRENCY,
  mapWithConcurrency,
  validatePhoneNumber,
  validateWebhook,
} from './utils.js'

/**
 * The SmsClient acts as an adapter that wraps a driver and exposes a consistent
 * API for sending and queueing sms messages
 */
export class SmsClient<Driver extends SmsDriverContract> {
  /**
   * Reference to the AdonisJS application emitter
   */
  #emitter: EmitterLike<SmsEvents>

  /**
   * Messenger used for queueing messages
   */
  #messenger: SmsMessenger

  constructor(
    public name: string,
    public driver: Driver,
    emitter: EmitterLike<SmsEvents>,
    public config: SmsConfig = {}
  ) {
    this.#emitter = emitter
    this.#messenger = new MemoryQueueMessenger(this as any, this.#emitter)
  }

  /**
   * Configure the messenger used to send messages in the background
   */
  setMessenger(messenger: SmsMessenger): this {
    this.#messenger = messenger

    return this
  }

  /**
   * Sends an already compiled message using the underlying driver
   */
  async sendCompiled(sms: CompiledSmsNode): Promise<Awaited<ReturnType<Driver['send']>>> {
    const message = { ...sms.message, from: this.resolveSender(sms.message.from) }
    const config = this.resolveWebhook(sms.config)

    this.#emitter.emit('sms:sending', { clientName: this.name, message })

    debug('sending sms to "%s" using the "%s" client', message.to, this.name)
    const response = await this.driver.send(message, config)

    this.#emitter.emit('sms:sent', { clientName: this.name, message, response })

    return response as Awaited<ReturnType<Driver['send']>>
  }

  /**
   * Sends a message composed using the callback
   */
  async send(
    callback: MessageComposeCallback,
    runtimeOptions?: Parameters<Driver['send']>[1]
  ): Promise<Awaited<ReturnType<Driver['send']>>> {
    const message = new Message(this.config)
    await callback(message)

    return this.sendCompiled({
      message: message.toJSON(),
      clientName: this.name,
      config: runtimeOptions,
    })
  }

  /**
   * Queues a message composed using the callback. The message is delivered
   * in the background by the configured messenger
   */
  async sendLater(
    callback: MessageComposeCallback,
    runtimeOptions?: Parameters<Driver['send']>[1]
  ): Promise<void> {
    const message = new Message(this.config)
    await callback(message)

    await this.#messenger.queue({
      message: message.toJSON(),
      clientName: this.name,
      config: runtimeOptions,
    })
  }

  /**
   * Sends the exact same message to many recipients
   */
  async sendMany(
    callback: ManyMessagesComposeCallback,
    runtimeOptions?: Parameters<Driver['sendMany']>[1]
  ): Promise<Awaited<ReturnType<Driver['sendMany']>>> {
    const messages = new ManyMessages(this.config)
    await callback(messages)

    const { to, message, from } = messages.toJSON()
    const config = this.resolveWebhook(runtimeOptions)

    return this.driver.sendMany({ to, message, from: this.resolveSender(from) }, config) as Promise<
      Awaited<ReturnType<Driver['sendMany']>>
    >
  }

  /**
   * Sends a different message to every recipient. Drivers not implementing
   * "sendBulk" fallback to multiple "send" calls
   */
  async sendBulk(
    callback: BulkMessageComposeCallback,
    runtimeOptions?: Parameters<Driver['send']>[1]
  ): Promise<Awaited<ReturnType<Driver['send']>>[]> {
    const bulkMessage = new BulkMessage()
    await callback(bulkMessage)

    const compiled = bulkMessage.toJSON()
    const { from, to } = compiled

    to.forEach(([recipient]) => validatePhoneNumber(recipient))

    const config = this.resolveWebhook(runtimeOptions)
    const sender = this.resolveSender(from)

    if (typeof this.driver.sendBulk === 'function') {
      return this.driver.sendBulk({ ...compiled, from: sender }, config) as Promise<
        Awaited<ReturnType<Driver['send']>>[]
      >
    }

    const concurrency =
      this.driver.getConfig().concurrency ?? this.config.concurrency ?? DEFAULT_CONCURRENCY

    return mapWithConcurrency(to, concurrency, ([recipient, message]) =>
      this.driver.send({ to: recipient, message, from: sender }, config)
    ) as Promise<Awaited<ReturnType<Driver['send']>>[]>
  }

  /**
   * Resolves the sender from the message, falling back to the driver config
   * and then to the global config
   */
  protected resolveSender(from?: string) {
    const sender = from || this.driver.getConfig().from || this.config.from

    if (!sender) {
      throw new errors.E_NO_SENDER_PROVIDED()
    }

    return sender
  }

  /**
   * Appends the webhook URL to the driver options when the driver supports
   * delivery reports. The URL is read from the runtime options, then from the
   * driver config and finally from the global config
   */
  protected resolveWebhook(runtimeOptions?: any) {
    if (!this.driver.acceptWebhook) {
      return runtimeOptions
    }

    const webhook =
      runtimeOptions?.webhook ?? this.driver.getConfig().webhook ?? this.config.webhook

    if (!webhook) {
      return runtimeOptions
    }

    validateWebhook(webhook)

    return { ...runtimeOptions, webhook }
  }
}
