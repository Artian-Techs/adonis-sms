import { SmsMessageContract, Sender, Recipient, MessageNode } from '@ioc:Adonis/Addons/Sms'

export default class Message implements SmsMessageContract {
  #smsNode = {
    from: '',
    to: [],
    message: '',
  } as MessageNode

  constructor() {}

  public from(from: Sender) {
    this.#smsNode.from = from

    return this
  }

  public to(...to: Array<Recipient>) {
    this.#smsNode.to.push(...to)

    return this
  }

  public toAll(to: Array<Recipient>) {
    this.#smsNode.to.push(...to)

    return this
  }

  public message(message: string) {
    this.#smsNode.message = message

    return this
  }

  public toJSON(): MessageNode {
    this.#smsNode.to = [...new Set([...this.#smsNode.to!])]

    return this.#smsNode
  }
}
