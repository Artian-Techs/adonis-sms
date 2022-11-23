import type { SmsMessageContract, SmsManagerContract, SmserContract } from '@ioc:Adonis/Addons/Sms'

export default abstract class BaseSmser {
  /**
   * Reference to the smser. Assigned inside the service provider.
   */
  public static sms: SmsManagerContract
  public sms = (this.constructor as typeof BaseSmser).sms

  /**
   * An optional method to use a custom smser and its options
   */
  public smser?: SmserContract<any>

  /**
   * Prepare sms message
   */
  public abstract prepare(message: SmsMessageContract): Promise<any> | any

  /**
   * Send sms
   */
  public async send() {
    return (this.smser || this.sms.use()).send(async (sms) => {
      await this.prepare(sms)
    })
  }

  /**
   * Send sms by pushing it to the in-memory queue
   */
  public async sendLater() {
    return (this.smser || this.sms.use()).sendLater(async (sms) => {
      await this.prepare(sms)
    })
  }
}
