import { Exception } from '@poppinss/utils'

export default class InvalidWebhookProtocolException extends Exception {
  public static invoke(protocol: string) {
    return new this(
      `${protocol} is not a valid protocol. Valid protocols are HTTP and HTTPS`,
      500,
      'E_INVALID_WEBHOOK_PROTOCOL'
    )
  }
}
