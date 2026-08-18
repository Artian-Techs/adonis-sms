import type { EmitterLike } from '@adonisjs/core/types/events'
import type {
  BulkMessageComposeCallback,
  CompiledSmsNode,
  ManyMessagesComposeCallback,
  MessageComposeCallback,
  MessageNode,
  SmsDriverContract,
  SmsEvents,
  SmsConfig,
} from './types.js'

import { AssertionError } from 'node:assert'

import { SmsClient } from './sms_client.js'
import { SmsResponse } from './sms_response.js'
import { BaseDriver } from './drivers/base_driver.js'

/**
 * A message recorded by the fake client
 */
export type FakedSms = {
  message: MessageNode
  config?: unknown

  /**
   * Whether the message went through "sendLater" rather than "send"
   */
  queued: boolean
}

/**
 * Predicate used to narrow the recorded messages
 */
export type FakedSmsFinder = (sms: FakedSms) => boolean

/**
 * A driver that records everything instead of contacting a provider
 */
class FakeDriver extends BaseDriver {
  async send(message: MessageNode) {
    return new SmsResponse(`fake-${message.to}`, { message })
  }

  async sendMany(message: { to: string[]; from: string; message: string }) {
    return message.to.map((to) => new SmsResponse(`fake-${to}`, { message }))
  }
}

/**
 * The fake client records the messages your application sends instead of
 * delivering them, and exposes assertions over what was recorded
 */
export class FakeSmsClient extends SmsClient<SmsDriverContract> {
  #sent: FakedSms[] = []

  constructor(name: string, emitter: EmitterLike<SmsEvents>, config: SmsConfig = {}) {
    super(name, new FakeDriver(config), emitter, config)
  }

  /**
   * The messages recorded so far
   */
  get sentMessages(): FakedSms[] {
    return this.#sent
  }

  /**
   * Forget every recorded message
   */
  clear(): this {
    this.#sent = []

    return this
  }

  async sendCompiled(sms: CompiledSmsNode): Promise<any> {
    const message = { ...sms.message, from: this.resolveSender(sms.message.from) }
    this.#sent.push({ message, config: sms.config, queued: false })

    return new SmsResponse(`fake-${message.to}`, { message })
  }

  async send(callback: MessageComposeCallback, runtimeOptions?: unknown): Promise<any> {
    return super.send(callback as any, runtimeOptions as any)
  }

  async sendLater(callback: MessageComposeCallback, runtimeOptions?: unknown): Promise<void> {
    await super.send(callback as any, runtimeOptions as any)
    this.#sent[this.#sent.length - 1].queued = true
  }

  async sendMany(callback: ManyMessagesComposeCallback, runtimeOptions?: unknown): Promise<any> {
    const responses = await super.sendMany(callback as any, runtimeOptions as any)

    return responses
  }

  async sendBulk(callback: BulkMessageComposeCallback, runtimeOptions?: unknown): Promise<any> {
    return super.sendBulk(callback as any, runtimeOptions as any)
  }

  /**
   * Returns the recorded messages matching the predicate
   */
  filter(finder?: FakedSmsFinder): FakedSms[] {
    return finder ? this.#sent.filter(finder) : this.#sent
  }

  /**
   * Returns the first recorded message matching the predicate
   */
  find(finder?: FakedSmsFinder): FakedSms | undefined {
    return this.filter(finder)[0]
  }

  #fail(message: string): never {
    throw new AssertionError({ message })
  }

  #describe(finder?: FakedSmsFinder) {
    return finder ? ' matching the given predicate' : ''
  }

  /**
   * Asserts at least one message was sent
   */
  assertSent(finder?: FakedSmsFinder): void {
    if (!this.filter(finder).length) {
      this.#fail(
        `Expected an sms${this.#describe(finder)} to have been sent, but none was. ` +
          `${this.#sent.length} message(s) recorded`
      )
    }
  }

  /**
   * Asserts no message was sent
   */
  assertNotSent(finder?: FakedSmsFinder): void {
    const matches = this.filter(finder)

    if (matches.length) {
      this.#fail(
        `Expected no sms${this.#describe(finder)} to have been sent, but ${matches.length} was/were`
      )
    }
  }

  /**
   * Asserts the exact number of messages sent
   */
  assertSentCount(count: number, finder?: FakedSmsFinder): void {
    const matches = this.filter(finder)

    if (matches.length !== count) {
      this.#fail(
        `Expected ${count} sms${this.#describe(finder)} to have been sent, but got ${matches.length}`
      )
    }
  }

  /**
   * Asserts nothing at all was sent
   */
  assertNoneSent(): void {
    this.assertSentCount(0)
  }

  /**
   * Asserts a message was queued through "sendLater"
   */
  assertQueued(finder?: FakedSmsFinder): void {
    const matches = this.filter(finder).filter((sms) => sms.queued)

    if (!matches.length) {
      this.#fail(`Expected an sms${this.#describe(finder)} to have been queued, but none was`)
    }
  }
}
