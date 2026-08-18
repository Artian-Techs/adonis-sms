import type { BulkMessageNode } from '../types.js'

/**
 * Fluent API to compose a different message for every recipient
 */
export class BulkMessage {
  /**
   * Sender phone number/name
   */
  #from?: string

  /**
   * [recipient, message] pairs
   */
  #to: Array<[recipient: string, message: string]> = []

  /**
   * Define the sender
   */
  from(from: string) {
    this.#from = from

    return this
  }

  /**
   * Add a set of [recipient, message] pairs. The method can be called
   * multiple times
   */
  to(data: Array<[recipient: string, message: string]>) {
    this.#to.push(...data)

    return this
  }

  /**
   * Returns the compiled message
   */
  toJSON(): BulkMessageNode {
    return {
      from: this.#from!,
      to: this.#to,
    }
  }
}
