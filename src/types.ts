import type { ConfigProvider } from '@adonisjs/core/types'
import type { PublishCommandOutput, PublishInput } from '@aws-sdk/client-sns'
import type {
  MessageInstance,
  MessageListInstanceCreateOptions,
} from 'twilio/lib/rest/api/v2010/account/message.js'

import type { SmsResponse } from './sms_response.js'

import type { SmsClient } from './sms_client.js'
import type { BaseSms } from './base_sms.js'
import type { SmsManager } from './sms_manager.js'
import type { Message } from './message/message.js'
import type { BulkMessage } from './message/bulk_message.js'
import type { ManyMessages } from './message/many_messages.js'
import type { ContentType, InfobipAuthType, SNSDefaultSmsType } from './enums.js'

/**
 * Union of the values held by an object, used to derive a type from
 * the "as const" objects exported by "enums.js"
 *
 * ```ts
 * ValuesOf<typeof SNSDefaultSmsType> // 'Promotional' | 'Transactional'
 * ```
 */
export type ValuesOf<T extends object> = T[keyof T]

/*
|--------------------------------------------------------------------------
| Message types
|--------------------------------------------------------------------------
*/

export interface BaseMessageNode {
  from: string
}

/**
 * Shape of a message sent to a single recipient
 */
export interface MessageNode extends BaseMessageNode {
  to: string
  message: string
}

/**
 * Shape of the same message sent to many recipients
 */
export interface ManyMessagesNode extends BaseMessageNode {
  to: string[]
  message: string
}

/**
 * Shape of many different messages, each one with its own recipient
 */
export interface BulkMessageNode extends BaseMessageNode {
  to: Array<[recipient: string, message: string]>
}

/**
 * Shape of a compiled sms. The compiled sms is queued for
 * delivering it later
 */
export type CompiledSmsNode = {
  message: MessageNode
  clientName: string
  config?: unknown
}

/**
 * Callbacks passed to the "send", "sendMany" and "sendBulk" methods
 * to compose the message
 */
export type MessageComposeCallback = (message: Message) => void | Promise<void>
export type ManyMessagesComposeCallback = (message: ManyMessages) => void | Promise<void>
export type BulkMessageComposeCallback = (message: BulkMessage) => void | Promise<void>

/*
|--------------------------------------------------------------------------
| Drivers
|--------------------------------------------------------------------------
*/

/**
 * Base config shared by every driver
 */
export interface SmsDriverConfig {
  from?: string
  webhook?: string

  /**
   * How many requests a fan-out performs at once when the provider has no
   * batch endpoint. Defaults to 10
   */
  concurrency?: number
}

/**
 * The interface every sms driver must adhere to
 */
export interface SmsDriverContract {
  /**
   * Indicates whether the driver is able to receive delivery
   * reports on a webhook URL
   */
  acceptWebhook: boolean

  /**
   * Returns the config the driver has been created with
   */
  getConfig(): SmsDriverConfig

  /**
   * Sends one message to one recipient
   */
  send(message: MessageNode, config?: any): Promise<SmsResponse<any>>

  /**
   * Sends the same message to many recipients.
   *
   * The returned array holds one entry per message the provider reported.
   * Providers answering at the batch level return a single entry, so the
   * array must never be indexed by recipient
   */
  sendMany(message: ManyMessagesNode, config?: any): Promise<SmsResponse<any>[]>

  /**
   * Sends different messages to different recipients. Drivers not
   * implementing this method fallback to multiple "send" calls
   */
  sendBulk?(message: BulkMessageNode, config?: any): Promise<SmsResponse<any>[]>
}

/**
 * Factory function to lazily create a driver instance
 */
export type SmsDriverFactory = () => SmsDriverContract

/*
|--------------------------------------------------------------------------
| Vonage
|--------------------------------------------------------------------------
*/

export interface VonageDriverConfig extends SmsDriverConfig {
  /**
   * API key from the Vonage API. Used for basic auth. Optional when
   * "applicationId" and "privateKey" are defined
   */
  apiKey?: string

  /**
   * API secret from the Vonage API. Used for basic auth. Optional when
   * "applicationId" and "privateKey" are defined
   */
  apiSecret?: string

  /**
   * The Vonage application ID used to create the JWT. JWT is the
   * authentication method recommended by Vonage for the Messages API
   */
  applicationId?: string

  /**
   * The private key used to create the JWT. Either the file contents as a
   * Buffer, the path to the key file on disk, or the key itself
   */
  privateKey?: Buffer | string

  /**
   * The encoding used for the message. Defaults to "auto", which lets the
   * Messages API detect unicode characters
   */
  encodingType?: 'unicode' | 'text' | 'auto'

  /**
   * Satisfies the regulatory requirements of some countries
   */
  contentId?: string

  /**
   * Satisfies the regulatory requirements of some countries
   */
  entityId?: string

  /**
   * Append info to the User-Agent sent to Vonage
   */
  appendToUserAgent?: string

  /**
   * Custom timeout for requests to Vonage in milliseconds
   */
  timeout?: number

  /**
   * Custom host to use instead of "api.nexmo.com"
   */
  apiHost?: string
}

export interface VonageRuntimeOptions extends Pick<
  VonageDriverConfig,
  'webhook' | 'encodingType' | 'contentId' | 'entityId'
> {
  /**
   * The duration in seconds during which the delivery will be attempted
   */
  ttl?: number

  /**
   * Your own reference for the message, echoed back on the webhook
   */
  clientRef?: string

  /**
   * Overrides the Fraud Defender protections for this message. Only has an
   * effect on accounts subscribed to Fraud Defender Premium
   */
  trustedRecipient?: boolean

  /**
   * The version of the delivery receipt sent to the webhook
   */
  webhookVersion?: 'v0.1' | 'v1'
}

/**
 * The Messages API answers with a single identifier, whatever the channel
 */
export interface VonageResponse {
  messageUUID: string
}

/*
|--------------------------------------------------------------------------
| Twilio
|--------------------------------------------------------------------------
*/

export interface TwilioDriverConfig
  extends
    SmsDriverConfig,
    Omit<
      MessageListInstanceCreateOptions,
      'body' | 'from' | 'mediaUrl' | 'sendAt' | 'statusCallback' | 'to'
    > {
  accountSid: string
  authToken: string

  /**
   * A valid Twilio phone number (E.164 format) from your account
   */
  from: string

  /**
   * Twilio edge to use. Defaults to none
   */
  edge?: string

  /**
   * Twilio region to use. Defaults to "us1" when an edge is defined
   */
  region?: string

  /**
   * Enable lazy loading. Defaults to true
   */
  lazyLoading?: boolean

  /**
   * Additions to the user agent string
   */
  userAgentExtensions?: string[]
}

export interface TwilioRuntimeOptions
  extends
    Omit<
      TwilioDriverConfig,
      | 'body'
      | 'from'
      | 'accountSid'
      | 'authToken'
      | 'edge'
      | 'region'
      | 'lazyLoading'
      | 'userAgentExtensions'
    >,
    Pick<MessageListInstanceCreateOptions, 'mediaUrl' | 'sendAt'> {}

/**
 * Twilio answers with the created message resource
 */
export type TwilioResponse = MessageInstance

/*
|--------------------------------------------------------------------------
| Amazon SNS
|--------------------------------------------------------------------------
*/

export interface SNSDriverConfig extends Omit<SmsDriverConfig, 'webhook'> {
  key: string
  secret: string
  region: string

  /**
   * The type of sms message you will send by default.
   *
   * Promotional - (Default) Noncritical messages, such as marketing messages.
   * Amazon SNS optimizes the message delivery to incur the lowest cost.
   *
   * Transactional - Critical messages that support customer transactions, such as
   * one-time passcodes for multi-factor authentication. Amazon SNS optimizes
   * the message delivery to achieve the highest reliability
   */
  type: ValuesOf<typeof SNSDefaultSmsType>

  /**
   * Custom endpoint for the SNS client. Mainly useful during tests
   */
  endpoint?: string

  /**
   * The maximum amount in USD that you are willing to spend each month to send
   * SMS messages. When Amazon SNS determines that sending an SMS message would
   * incur a cost that exceeds this limit, it stops sending SMS messages within
   * minutes.
   *
   * This option, like the three below it, is account wide rather than per
   * message. Defining any of them makes the driver call "SetSMSAttributes"
   * once, which requires the "sns:SetSMSAttributes" permission
   */
  monthlySpendLimit?: number

  /**
   * The name of the Amazon S3 bucket to receive daily sms usage reports from
   * Amazon SNS
   */
  usageReportS3Bucket?: string

  /**
   * The ARN of the IAM role that allows Amazon SNS to write logs about sms
   * deliveries in CloudWatch Logs
   */
  deliveryStatusIAMRole?: string

  /**
   * The percentage of successful sms deliveries for which Amazon SNS will write
   * logs in CloudWatch Logs. The value can be an integer from 0 to 100
   */
  deliveryStatusSuccessSamplingRate?: number
}

export interface SNSRuntimeOptions extends Omit<PublishInput, 'PhoneNumber' | 'Message'> {
  /**
   * Overrides the message type for this message only. Sent as the
   * "AWS.SNS.SMS.SMSType" message attribute
   */
  smsType?: ValuesOf<typeof SNSDefaultSmsType>

  /**
   * The maximum amount in USD you are willing to spend on this message. Sent
   * as the "AWS.SNS.SMS.MaxPrice" message attribute
   */
  maxPrice?: number
}

/**
 * Amazon SNS answers with the publish result
 */
export type SNSResponse = PublishCommandOutput

/*
|--------------------------------------------------------------------------
| Infobip
|--------------------------------------------------------------------------
*/

export interface InfobipDriverConfig extends SmsDriverConfig {
  /**
   * Get it from https://www.infobip.com/docs/essentials/base-url
   */
  baseUrl: string
  apiKey?: string
  authType?: ValuesOf<typeof InfobipAuthType>
  username?: string
  password?: string

  /**
   * Allows for sending a flash SMS to automatically appear on recipient
   * devices without interaction. Defaults to false
   */
  flash?: boolean
  webhookContentType?: ValuesOf<typeof ContentType>

  /**
   * The real-time intermediate delivery report containing GSM error codes,
   * message status, pricing, network and country codes, etc., which will be
   * sent to your callback server. Defaults to false
   */
  intermediateReport?: boolean

  /**
   * Limits the send speed when sending messages in bulk to deliver messages
   * over a longer period of time
   */
  sendingSpeedLimit?: {
    /**
     * The number of messages to be sent per "timeUnit"
     */
    amount: number

    /**
     * The time unit to use when setting a messaging speed limit.
     * Defaults to MINUTE
     */
    timeUnit: 'MINUTE' | 'HOUR' | 'DAY'
  }
}

/**
 * The per destination entry returned by Infobip.
 *
 * The driver copies the "bulkId" of the enclosing response onto every entry,
 * since it is what identifies the batch when fetching delivery reports
 */
export interface InfobipMessageResponse {
  to?: string
  messageId?: string
  bulkId?: string
  status?: {
    id?: number
    groupId?: number
    groupName?: string
    name?: string
    description?: string
  }
}

export interface InfobipResponse {
  bulkId?: string
  messages: InfobipMessageResponse[]
}

export interface InfobipRuntimeOptions extends Pick<
  InfobipDriverConfig,
  'webhook' | 'webhookContentType' | 'flash' | 'intermediateReport' | 'sendingSpeedLimit'
> {
  /**
   * Unique ID assigned to the request when messaging multiple recipients or
   * sending multiple messages via a single API request. Auto-generated when
   * not provided
   */
  bulkId?: string
  sendAt?: Date

  /**
   * Additional data that can be used for identifying, managing or monitoring
   * a message. The maximum value is 4000 characters
   */
  callbackData?: string
}

/*
|--------------------------------------------------------------------------
| SmsClient
|--------------------------------------------------------------------------
*/

/**
 * Global config shared by all the clients
 */
export type SmsConfig = {
  /**
   * Global sender ID (phone number or alphanumeric name) used when the
   * message and the driver config do not define one
   */
  from?: string

  /**
   * Global webhook URL used when the message and the driver config do not
   * define one
   */
  webhook?: string

  /**
   * How many requests a fan-out performs at once when the provider has no
   * batch endpoint. Overridden per driver, defaults to 10
   */
  concurrency?: number

  /**
   * Replace consecutive whitespaces inside the message body by a single space
   */
  trim?: boolean

  /**
   * Remove accents from the message body
   */
  normalize?: boolean
}

/**
 * Events emitted by the client
 */
export type SmsEvents = {
  'sms:sending': {
    clientName: string
    message: MessageNode
  }
  'sms:sent': {
    clientName: string
    message: MessageNode
    response: SmsResponse<unknown>
  }
  'queued:sms:error': {
    clientName: string
    error: Error
  }
}

/**
 * The messenger is used to send messages in the background. The default
 * implementation uses an in-memory queue
 */
export interface SmsMessenger {
  queue(sms: CompiledSmsNode): Promise<void>
}

/*
|--------------------------------------------------------------------------
| Container and config inference
|--------------------------------------------------------------------------
*/

/**
 * A list of known clients inferred from the user config file. The
 * interface is meant to be augmented inside the user application
 */
export interface SmsClientsList {}

/**
 * Infers the clients from the config exported by the "config/sms.ts" file
 */
export type InferSmsClients<
  T extends ConfigProvider<{ clients: Record<string, SmsDriverFactory> }>,
> = Awaited<ReturnType<T['resolver']>>['clients']

/**
 * The sms service is a singleton instance of the sms manager configured
 * using the user app's config
 */
export interface SmsService extends SmsManager<
  SmsClientsList extends Record<string, SmsDriverFactory> ? SmsClientsList : never
> {}

export type { SmsClient, BaseSms, SmsManager }
