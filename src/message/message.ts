import type { MessageNode, SmsConfig } from '../types.js'

import { validatePhoneNumber, normalizeMessage, removeExtraSpaces, checkMessage } from '../utils.js'

/**
 * Fluent API to compose a message for a single recipient
 */
export class Message {
  /**
   * Sender phone number/name
   */
  #from?: string

  /**
   * Recipient phone number
   */
  #to?: string

  /**
   * SMS content
   */
  #message?: string

  constructor(protected config: SmsConfig = {}) {}

  /**
   * Define the sender
   */
  from(from: string) {
    this.#from = from

    return this
  }

  /**
   * Define the recipient
   */
  to(to: string) {
    validatePhoneNumber(to)
    this.#to = to

    return this
  }

  /**
   * Define the message body
   */
  message(message: string) {
    this.#message = message

    return this
  }

  /**
   * Applies the "trim" and "normalize" options from the config
   */
  protected prepareMessage(message?: string) {
    checkMessage(message)

    let body = message!

    if (this.config.trim) {
      body = removeExtraSpaces(body)
    }

    if (this.config.normalize) {
      body = normalizeMessage(body)
    }

    return body
  }

  /**
   * Returns the compiled message
   */
  toJSON(): MessageNode {
    return {
      from: this.#from!,
      to: this.#to!,
      message: this.prepareMessage(this.#message),
    }
  }
}
