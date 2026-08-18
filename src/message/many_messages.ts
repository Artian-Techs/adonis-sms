import type { ManyMessagesNode, SmsConfig } from '../types.js'

import { validatePhoneNumber, normalizeMessage, removeExtraSpaces, checkMessage } from '../utils.js'

/**
 * Fluent API to compose the same message for many recipients
 */
export class ManyMessages {
  /**
   * Sender phone number/name
   */
  #from?: string

  /**
   * Recipients phone numbers
   */
  #to: string[] = []

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
   * Add one or many recipients. The method can be called multiple times
   */
  to(to: string): this
  to(to: string[]): this
  to(to: string | string[]): this {
    const recipients = Array.isArray(to) ? to : [to]

    recipients.forEach((phoneNumber) => validatePhoneNumber(phoneNumber))
    this.#to.push(...recipients)

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
   * Returns the compiled message with duplicate recipients removed
   */
  toJSON(): ManyMessagesNode {
    return {
      from: this.#from!,
      to: [...new Set(this.#to)],
      message: this.prepareMessage(this.#message),
    }
  }
}
