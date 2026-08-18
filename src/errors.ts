import { createError } from '@poppinss/utils'

/*
|--------------------------------------------------------------------------
| Status codes
|--------------------------------------------------------------------------
|
| Mistakes made by the caller when composing a message are reported as 422,
| so an invalid phone number surfaces as a validation error rather than an
| internal one. A rejection coming from the provider is a 400. Only a broken
| configuration, which the caller cannot fix at runtime, stays a 500.
|
*/

/**
 * Raised when the recipient phone number is not in the E.164 format
 */
export const E_INVALID_PHONE_NUMBER = createError<[to: string]>(
  'The provided phone number is invalid (%s). Use the E.164 format for a valid phone number, e.g: +121212121212',
  'E_INVALID_PHONE_NUMBER',
  422
)

/**
 * Raised when the webhook URL cannot be parsed
 */
export const E_INVALID_WEBHOOK_FORMAT = createError<[webhook: string]>(
  '"%s" is not a valid URL',
  'E_INVALID_WEBHOOK_FORMAT',
  422
)

/**
 * Raised when the webhook URL uses a protocol other than HTTP or HTTPS
 */
export const E_INVALID_WEBHOOK_PROTOCOL = createError<[protocol: string]>(
  '"%s" is not a valid protocol. Valid protocols are HTTP and HTTPS',
  'E_INVALID_WEBHOOK_PROTOCOL',
  422
)

/**
 * Raised when the message body is missing or empty
 */
export const E_MISSING_MESSAGE = createError(
  'Message cannot be empty or undefined',
  'E_MISSING_MESSAGE',
  422
)

/**
 * Raised when a required parameter has not been defined on the message
 */
export const E_MISSING_PARAMETER = createError<[parameter: string]>(
  '"%s" parameter is missing',
  'E_MISSING_PARAMETER',
  422
)

/**
 * Raised when neither the message, nor the driver config, nor the global
 * config define a sender
 */
export const E_NO_SENDER_PROVIDED = createError(
  'You must provide at least one "from" address (phone number or string) inside "config/sms.ts" or through the send method',
  'E_NO_SENDER_PROVIDED',
  500
)

/**
 * Raised when the sms driver is unable to deliver the message
 */
export const E_SMS_DRIVER_ERROR = createError<[message: string]>('%s', 'E_SMS_DRIVER_ERROR', 400)
