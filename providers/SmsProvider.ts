import { ApplicationContract } from '@ioc:Adonis/Core/Application'

export default class SmsProvider {
  protected needsApplication = true

  constructor(protected app: ApplicationContract) {}

  public register() {
    this.app.container.singleton('Adonis/Addons/Sms', () => {
      const config = this.app.container.resolveBinding('Adonis/Core/Config').get('sms', {})
      const SmsManager = require('../src/Sms/SmsManager').default

      return new SmsManager(this.app, config)
    })
  }

  /**
   * Setup REPL bindings
   */
  public boot() {
    if (this.app.environment !== 'repl') {
      return
    }

    this.app.container.withBindings(['Adonis/Addons/Repl'], (Repl) => {
      const { defineReplBindings } = require('../src/Bindings/Repl')
      defineReplBindings(this.app, Repl)
    })
  }
}
