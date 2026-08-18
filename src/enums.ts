/**
 * The content type used by Infobip when posting a delivery report to
 * your webhook
 */
export const ContentType = {
  JSON: 'application/json',
  XML: 'application/xml',
} as const

/**
 * The authentication method used to talk to the Infobip API
 */
export const InfobipAuthType = {
  Basic: 'Basic',
  ApiKey: 'App',
} as const

/**
 * The type of sms message sent through Amazon SNS
 *
 * Promotional - (Default) Noncritical messages, such as marketing messages.
 * Amazon SNS optimizes the message delivery to incur the lowest cost.
 *
 * Transactional - Critical messages that support customer transactions, such
 * as one-time passcodes for multi-factor authentication. Amazon SNS optimizes
 * the message delivery to achieve the highest reliability.
 */
export const SNSDefaultSmsType = {
  Promotional: 'Promotional',
  Transactional: 'Transactional',
} as const
