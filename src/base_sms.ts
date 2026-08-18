import type { SmsDriverContract } from './types.js'
import type { SmsClient } from './sms_client.js'

import { Message } from './message/message.js'

/**
 * Class based sms messages are self contained dispatchable objects
 */
export abstract class BaseSms {
  /**
   * A flag to avoid building the message multiple times
   */
  protected built: boolean = false

  /**
   * Reference to the message object
   */
  message = new Message()

  /**
   * Define the sender for the message
   */
  from?: string

  /**
   * Defines the sender on the message using the class "from" property
   */
  protected defineSender() {
    if (this.from) {
      this.message.from(this.from)
    }
  }

  /**
   * Prepares the message
   */
  abstract prepare(): void | Promise<void>

  /**
   * Builds the message for sending it
   */
  async build(): Promise<void> {
    if (this.built) {
      return
    }

    this.built = true
    this.defineSender()
    await this.prepare()
  }

  /**
   * Sends the message using the given client
   */
  async send<Driver extends SmsDriverContract>(
    client: SmsClient<Driver>,
    config?: Parameters<Driver['send']>[1]
  ): Promise<Awaited<ReturnType<Driver['send']>>> {
    await this.build()

    return client.sendCompiled({
      message: this.message.toJSON(),
      clientName: client.name,
      config,
    })
  }

  /**
   * Queues the message using the given client
   */
  async sendLater<Driver extends SmsDriverContract>(
    client: SmsClient<Driver>,
    config?: Parameters<Driver['send']>[1]
  ): Promise<void> {
    await this.build()

    await client.sendLater(async (message) => {
      const { from, to, message: body } = this.message.toJSON()

      if (from) {
        message.from(from)
      }

      message.to(to).message(body)
    }, config)
  }
}
