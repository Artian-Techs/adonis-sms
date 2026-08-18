import type { EmitterLike } from '@adonisjs/core/types/events'
import type { CompiledSmsNode, SmsDriverContract, SmsEvents, SmsMessenger } from '../types.js'
import type { SmsClient } from '../sms_client.js'

import fastq, { type done } from 'fastq'

import { debug } from '../debug.js'

/**
 * Worker to send the queued messages
 */
function sendSms(this: MemoryQueueMessenger, sms: CompiledSmsNode, cb: done) {
  this.client
    .sendCompiled(sms)
    .then((result) => cb(null, result))
    .catch((error) => cb(error))
}

/**
 * The memory queue messenger uses the "fastq" package to keep messages within
 * memory and send them in chunks of 10
 */
export class MemoryQueueMessenger implements SmsMessenger {
  #emitter: EmitterLike<SmsEvents>
  #queue = fastq(this, sendSms, 10)
  #jobCompletedCallback = (error: Error | null) => {
    if (error) {
      this.#emitter.emit('queued:sms:error', {
        error,
        clientName: this.client.name,
      })
    }
  }

  constructor(
    public client: SmsClient<SmsDriverContract>,
    emitter: EmitterLike<SmsEvents>
  ) {
    this.#emitter = emitter
  }

  /**
   * Queues the message within memory
   */
  async queue(sms: CompiledSmsNode) {
    debug('pushing sms to in-memory queue')
    this.#queue.push(sms, this.#jobCompletedCallback)
  }
}
