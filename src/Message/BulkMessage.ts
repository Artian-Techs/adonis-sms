import {
  BulkSmsMessageContract,
  BulkMessageNode,
  Sender,
  Recipient,
  Message,
} from '@ioc:Adonis/Addons/Sms'

export default class BulkMessage implements BulkSmsMessageContract {
  #bulkMessageNode = {
    from: '',
    to: [],
  } as BulkMessageNode

  constructor() {}

  public from(from: Sender) {
    this.#bulkMessageNode.from = from

    return this
  }

  public to(...data: Array<[Recipient, Message]>) {
    this.#bulkMessageNode.to.push(...data)

    return this
  }

  public toAll(data: Array<[Recipient, Message]>) {
    this.#bulkMessageNode.to.push(...data)

    return this
  }

  public toJSON(): BulkMessageNode {
    return this.#bulkMessageNode
  }
}
