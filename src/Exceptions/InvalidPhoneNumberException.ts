import type { Recipient } from '@ioc:Adonis/Addons/Sms'

import { Exception } from '@poppinss/utils'

export default class InvalidPhoneNumberException extends Exception {
  public static invoke(to: Recipient) {
    return new this(
      `The provided phone number is invalid (${to}). Use E.164 format for a valid phone number, e.g: +121212121212`,
      500,
      'E_INVALID_PHONE_NUMBER'
    )
  }
}
