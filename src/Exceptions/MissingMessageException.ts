import { Exception } from '@poppinss/utils'

export default class MissingMessageException extends Exception {
  public static invoke() {
    return new this(`Message cannot empty or undefined`, 500, 'E_MISSING_MESSAGE')
  }
}
