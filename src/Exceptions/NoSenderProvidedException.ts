import { Exception } from '@poppinss/utils'

export default class NoSenderProvidedException extends Exception {
  public static invoke() {
    return new this(
      `You must provide at least one "from" address (phone number or string) inside "config/sms.ts" or through send method`,
      500,
      'E_NO_SENDER_PROVIDED'
    )
  }
}
