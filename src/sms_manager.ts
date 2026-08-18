import type { EmitterLike } from '@adonisjs/core/types/events'
import type {
  BulkMessageComposeCallback,
  ManyMessagesComposeCallback,
  MessageComposeCallback,
  SmsDriverContract,
  SmsDriverFactory,
  SmsEvents,
  SmsConfig,
  SmsMessenger,
} from './types.js'

import { RuntimeException } from '@poppinss/utils'

import { debug } from './debug.js'
import { SmsClient } from './sms_client.js'
import { FakeSmsClient } from './fake_sms_client.js'

/**
 * The sms manager exposes the API to configure multiple clients, manage their
 * lifecycle and switch between them
 */
export class SmsManager<KnownClients extends Record<string, SmsDriverFactory>> {
  #emitter: EmitterLike<SmsEvents>

  /**
   * Messenger to use on all the clients created by this manager
   */
  #messenger?: (client: SmsClient<SmsDriverContract>) => SmsMessenger

  /**
   * Cache of clients
   */
  #clientsCache: Partial<Record<keyof KnownClients, SmsClient<SmsDriverContract>>> = {}

  /**
   * Reference to the fake client, when the fake mode is on
   */
  #fakeClient?: FakeSmsClient

  constructor(
    emitter: EmitterLike<SmsEvents>,
    public config: SmsConfig & {
      default?: keyof KnownClients
      clients: KnownClients
    }
  ) {
    debug('creating sms manager %O', config)
    this.#emitter = emitter
  }

  /**
   * Configure the messenger used by all the clients managed by this class
   */
  setMessenger(messenger: (client: SmsClient<SmsDriverContract>) => SmsMessenger): this {
    this.#messenger = messenger

    Object.keys(this.#clientsCache).forEach((name) => {
      const client = this.#clientsCache[name]!
      client.setMessenger(messenger(client))
    })

    return this
  }

  /**
   * Create/use an instance of a known client. The instances are cached for
   * the lifecycle of the process
   */
  use<K extends keyof KnownClients>(clientName?: K): SmsClient<ReturnType<KnownClients[K]>> {
    const clientToUse = clientName || this.config.default

    if (!clientToUse) {
      throw new RuntimeException(
        'Cannot create client instance. No default client is defined in the config'
      )
    }

    if (!this.config.clients[clientToUse]) {
      throw new RuntimeException(
        `Unknown client "${String(clientToUse)}". Make sure it is configured inside the config file`
      )
    }

    /**
     * Every client resolves to the fake one while the fake mode is on
     */
    if (this.#fakeClient) {
      return this.#fakeClient as unknown as SmsClient<ReturnType<KnownClients[K]>>
    }

    /**
     * Use the cached copy if it exists
     */
    const cachedClient = this.#clientsCache[clientToUse]
    if (cachedClient) {
      debug('using client from cache. name: "%s"', clientToUse)

      return cachedClient as SmsClient<ReturnType<KnownClients[K]>>
    }

    debug('creating client driver. name: "%s"', clientToUse)
    const driverFactory = this.config.clients[clientToUse]
    const client = new SmsClient(clientToUse as string, driverFactory(), this.#emitter, this.config)

    if (this.#messenger) {
      client.setMessenger(this.#messenger(client))
    }

    this.#clientsCache[clientToUse] = client

    return client as SmsClient<ReturnType<KnownClients[K]>>
  }

  /**
   * Turn on the fake mode. Every call to "use" then returns a fake client that
   * records the messages instead of delivering them
   */
  fake(): FakeSmsClient {
    this.restore()

    debug('creating fake client')
    this.#fakeClient = new FakeSmsClient('fake', this.#emitter, this.config)

    return this.#fakeClient
  }

  /**
   * Turn off the fake mode and restore the real clients
   */
  restore(): void {
    if (this.#fakeClient) {
      this.#fakeClient = undefined
      debug('restoring client fake')
    }
  }

  /**
   * Send a message using the default client
   */
  send<K extends keyof KnownClients>(
    callback: MessageComposeCallback,
    runtimeOptions?: Parameters<ReturnType<KnownClients[K]>['send']>[1]
  ) {
    return this.use().send(callback, runtimeOptions)
  }

  /**
   * Queue a message using the default client
   */
  async sendLater<K extends keyof KnownClients>(
    callback: MessageComposeCallback,
    runtimeOptions?: Parameters<ReturnType<KnownClients[K]>['send']>[1]
  ) {
    await this.use().sendLater(callback, runtimeOptions)
  }

  /**
   * Send the exact same message to many recipients using the default client
   */
  sendMany<K extends keyof KnownClients>(
    callback: ManyMessagesComposeCallback,
    runtimeOptions?: Parameters<ReturnType<KnownClients[K]>['sendMany']>[1]
  ) {
    return this.use().sendMany(callback, runtimeOptions)
  }

  /**
   * Send a different message to every recipient using the default client
   */
  sendBulk<K extends keyof KnownClients>(
    callback: BulkMessageComposeCallback,
    runtimeOptions?: Parameters<ReturnType<KnownClients[K]>['send']>[1]
  ) {
    return this.use().sendBulk(callback, runtimeOptions)
  }
}
