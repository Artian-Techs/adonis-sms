import { Exception } from '@poppinss/utils'

export default class InvalidWebhookFormatException extends Exception {
  public static invoke(webhook: string) {
    return new this(`${webhook} is not a valid URL`, 500, 'E_INVALID_WEBHOOK_FORMAT')
  }
}
