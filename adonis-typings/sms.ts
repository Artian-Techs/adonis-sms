declare module '@ioc:Adonis/Addons/Sms' {
  import type { ManagerContract } from '@poppinss/manager'
  import type { MessageListInstanceCreateOptions } from 'twilio/lib/rest/api/v2010/account/message'
  import type { MessageRequestResponse, SendSmsOptions } from '@vonage/server-sdk'
  import type { PublishInput } from 'aws-sdk/clients/sns'
  import type { ApplicationContract } from '@ioc:Adonis/Core/Application'

  type SmsConfig = import('../config').SmsConfig
  export interface InferSelectedSmserFromConfig {}

  type SNSDefaultSmsType = typeof import('../src/Enums/SNSDefaultSmsType').default
  type TelesignBatchUCID = typeof import('../src/Enums/TelesignBatchUCID').default
  type TelesignClientType = typeof import('../src/Enums/TelesignClientType').default
  type TelesignMessageType = typeof import('../src/Enums/TelesignMessageType').default

  export enum InfobipAuthType {
    Basic = 'Basic',
    ApiKey = 'App',
  }

  export enum ContentType {
    JSON = 'application/json',
    XML = 'application/xml',
  }

  export type Recipient = string
  export type Sender = Recipient
  export type Message = string
  export type Send = (sms: MessageNode) => Promise<any>

  /**
   * Infers the 2nd argument accepted by the driver send method
   */
  export type DriverOptionsType<Driver> = Driver extends SmsDriverContract
    ? Parameters<Driver['send']>[1]
    : never

  /**
   * Callback to monitor queues response
   */
  export type QueueMonitorCallback = (
    error?: Error & { sms: CompiledSmsNode },
    response?: {
      sms: CompiledSmsNode
      response: Responses[keyof SmsersList]
    }
  ) => void

  /**
   * Shape of the compiled sms.
   */
  export type CompiledSmsNode = {
    message: MessageNode
    smser: keyof SmsersList
    config?: any
  }

  /**
   * Base smser
   */
  export interface BaseSmserContract<Smser extends keyof SmsersList> {
    /**
     * Reference to the smser. Assigned inside the service provider
     */
    sms: SmsManagerContract

    /**
     * An optional method to use a custom smser and its options
     */
    smser?: SmserContract<Smser>

    /**
     * Prepare sms message
     */
    prepare(message: SmsMessageContract): Promise<any> | any

    /**
     * Send sms
     */
    send(): Promise<Responses[Smser]>

    /**
     * Send sms by pushing it to the in-memory queue
     */
    sendLater(): Promise<void>
  }

  export interface BaseMessageNode {
    from: Sender
  }

  export interface MessageNode extends BaseMessageNode {
    to: Array<Recipient>
    message: Message
  }

  export interface BulkMessageNode extends BaseMessageNode {
    to: Array<[Recipient, Message]>
  }

  export interface SmsMessageContract {
    from(from: Sender): this
    to(...to: Array<Recipient>): this
    toAll(to: Array<Recipient>): this
    message(message: Message): this
  }

  export interface BulkSmsMessageContract {
    from(from: Sender): this
    to(...data: Array<[Recipient, Message]>): this
    toAll(data: Array<[Recipient, Message]>): this
  }

  /**
   * Shape of the callback passed to the `send` method to compose the
   * message
   */
  export type MessageComposeCallback = (sms: SmsMessageContract) => void | Promise<void>
  export type BulkMessageComposeCallback = (sms: BulkSmsMessageContract) => void | Promise<void>

  export interface SmsersList {}

  export interface SmserContract<Name extends keyof SmsersList> {
    driver: SmsersList[Name]['implementation']

    sendCompiled(sms: CompiledSmsNode): Promise<Responses[Name]>
    send(
      callback: MessageComposeCallback,
      runtimeOptions?: RuntimeOptions[Name]
    ): Promise<Responses[InferSelectedSmserFromConfig['smser']]>
    sendLater(
      callback: MessageComposeCallback
    ): Promise<Responses[InferSelectedSmserFromConfig['smser']]>
    sendBulk(
      callback: BulkMessageComposeCallback
    ): Promise<Responses[InferSelectedSmserFromConfig['smser']]>
  }

  export interface SmsDriverContract {
    debug: boolean

    getConfig(): DriverConfig
    send(messageNode: MessageNode, driverRuntimeConfig?: any): Promise<any>

    sendBulk?(bulkMessageNode: BulkMessageNode, driverRuntimeConfig?: any): Promise<any>
  }

  export interface VonageDriverContract extends SmsDriverContract {}

  export interface TwilioDriverContract extends SmsDriverContract {}

  export interface D7DriverContract extends SmsDriverContract {}

  export interface SNSDriverContract extends SmsDriverContract {}

  export interface TelesignDriverContract extends SmsDriverContract {}

  export interface InfobipDriverContract extends SmsDriverContract {}

  export interface SmsAPIDriverContract extends SmsDriverContract {}

  /**
   * Drivers configurations
   */
  export interface DriverConfig {
    from?: string
    webhook?: string
  }

  export interface VonageDriverConfig extends DriverConfig {
    driver: 'vonage'
    apiKey: string // API Key from Vonage API. If applicationId and privateKey are present, apiKey is optional
    apiSecret: string // API SECRET from Vonage API. If applicationId and privateKey are present, apiSecret is optional
    applicationID?: string // (optional) The Vonage API Application ID to be used when creating JWTs

    /**
     * (optional) The Private Key to be used when creating JWTs. You can specify the key as any of the following:
     * A Buffer containing the file contents.
     * A String containing the path to the key file on disk.
     * A String containing the key itself.
     */
    privateKey?: Buffer | string
    signatureSecret?: string // (optional) API signature secret from Vonage API, used for signing Sms message requests

    /**
     * (optional) signature method matching the one you gave Vonage API, used for signing Sms message requests
     */
    signatureMethod?: 'md5hash' | 'md5' | 'sha1' | 'sha256' | 'sha512'
    appendToUserAgent?: string // (optional) Append info the the User-Agent sent to Vonage
    timeout?: number // (optional) Set a custom timeout for requests to Vonage in milliseconds. Defaults to 120 ms
    apiHost?: string // (optional) Set a custom host for requests instead of api.vonage.com
    restHost?: string // (optional) Set a custom host for requests instead of rest.vonage.com
  }

  export interface TwilioDriverConfig
    extends DriverConfig,
      Omit<
        MessageListInstanceCreateOptions,
        'body' | 'from' | 'mediaUrl' | 'sendAt' | 'statusCallback' | 'to'
      > {
    driver: 'twilio'
    accountSid: string
    authToken: string
    edge?: string // (optional) Twilio edge to use. Defaults to none
    region?: string // (optional) Twilio region to use. Defaults to us1 if edge defined
    lazyLoading?: boolean // (optional) Enable lazy loading, loading time will decrease if enabled. Defaults to true
    userAgentExtensions?: Array<string> // (optional) Additions to the user agent string
  }

  export interface D7DriverConfig extends DriverConfig {
    driver: 'd7'
    apiToken: string
    baseUrl: string
    /**
     * Set as text for normal GSM 03.38 characters (English, normal characters).
     * Set as unicode for non GSM 03.38 characters (Arabic, Chinese, Hebrew, Greek like regional languages and Unicode characters).
     * Set as auto to determine encoding based on the content.
     */
    dataCoding?: 'text' | 'unicode' | 'auto'
  }

  export interface SNSDriverConfig extends Omit<DriverConfig, 'webhook'> {
    driver: 'sns'
    apiVersion: string
    key: string
    secret: string
    region: string
    sslEnabled?: boolean
    /**
     * The type of Sms message that you will send by default. You can assign the following values:
     * Promotional – (Default) Noncritical messages, such as marketing messages. Amazon SNS optimizes the message delivery to incur the lowest cost.
     * Transactional – Critical messages that support customer transactions, such as one-time passcodes for multi-factor authentication. Amazon SNS optimizes the message delivery to achieve the highest reliability.
     */
    type: keyof SNSDefaultSmsType

    /**
     * The maximum amount in USD that you are willing to spend each month to send SMS messages.
     * When Amazon SNS determines that sending an SMS message would incur a cost that exceeds this limit,
     * it stops sending SMS messages within minutes.
     * Amazon SNS stops sending SMS messages within minutes of the limit being crossed.
     * During that interval, if you continue to send SMS messages, you will incur costs that exceed your limit.
     * By default, the spend limit is set to the maximum allowed by Amazon SNS.
     * If you want to raise the limit, submit an SNS Limit Increase case.
     * For New limit value, enter your desired monthly spend limit.
     * In the Use Case Description field, explain that you are requesting an SMS monthly spend limit increase.
     */
    monthlySpendLimit?: number

    /**
     * The name of the Amazon S3 bucket to receive daily Sms usage reports from Amazon SNS.
     * Each day, Amazon SNS will deliver a usage report as a CSV file to the bucket.
     * To receive the report, the bucket must have a policy that allows the Amazon SNS service principal to perform the s3:PutObject and s3:GetBucketLocation actions.
     */
    usageReportS3Bucket?: string

    /**
     * The ARN of the IAM role that allows Amazon SNS to write logs about Sms deliveries in CloudWatch Logs.
     * For each Sms message that you send, Amazon SNS writes a log that includes the message price, the success or failure status, the reason for failure (if the message failed), the message dwell time, and other information.
     */
    deliveryStatusIAMRole?: string

    /**
     * The percentage of successful Sms deliveries for which Amazon SNS will write logs in CloudWatch Logs.
     * The value can be an integer from 0 - 100.
     * For example, to write logs only for failed deliveries, set this value to 0.
     * To write logs for 10% of your successful deliveries, set it to 10.
     */
    deliveryStatusSuccessSamplingRate?: number
  }

  export interface TelesignDriverConfig extends DriverConfig {
    driver: 'telesign'
    type: keyof TelesignClientType
    customerId: string
    apiKey: string
    messageType: keyof TelesignMessageType
    ucid?: keyof TelesignBatchUCID // This is used for bulk sms system (Entreprise only) from Telesign
  }

  export interface InfobipDriverConfig extends DriverConfig {
    driver: 'infobip'
    baseURL: string // Get it from https://www.infobip.com/docs/essentials/base-url
    apiKey?: string
    authType?: InfobipAuthType
    username?: string
    password?: string

    /**
     * Allows for sending a flash SMS to automatically appear on
     * recipient devices without interaction.Defaults to false.
     */
    flash?: boolean
    webhookContentType?: ContentType

    /**
     * The real-time intermediate delivery report containing GSM error codes,
     * messages status, pricing, network and country codes, etc.,
     * which will be sent on your callback server. Defaults to false.
     */
    intermediateReport?: boolean

    /**
     * Limits the send speed when sending messages in bulk to deliver
     * messages over a longer period of time. You may wish to use this
     * to allow your systems or agents to handle large amounts of incoming
     * traffic, e.g., if you are expecting recipients to follow through
     * with a call-to-action option from a message you sent.
     * Not setting a send speed limit can overwhelm your resources with incoming traffic
     */
    sendingSpeedLimit?: {
      /**
       * The number of messages to be sent per timeUnit. By default,
       * the system sends messages as fast as the infrastructure allows.
       * Use this parameter to adapt sending capacity to your needs.
       * The system is only able to work against its maximum
       * capacity for ambitious message batches
       */
      amount: number // The time unit to define when setting a messaging speed limit
      timeUnit: 'MINUTE' | 'HOUR' | 'DAY' // Defaults to MINUTE
    }
  }

  export interface SmsAPIDriverConfig extends DriverConfig {
    driver: 'smsapi'
    accessToken: string
    encoding?:
      | 'iso-8859-1'
      | 'iso-8859-2'
      | 'iso-8859-3'
      | 'iso-8859-4'
      | 'iso-8859-5'
      | 'iso-8859-7'
      | 'windows-1250'
      | 'windows-1251'
      | 'utf-8'
    test?: boolean // If set to true, message won't be sent but response will be displayed (no charges)
    details?: boolean // Display more details (message length and sms count) in response

    /**
     * Sets the behavior when you try to ship in hours / dates that
     * do not match the settings in your account.
     * Available values are:
     * - follow: act according to settings
     * - ignore: ignore settings
     * - nearest_available: schedule shipment in the nearest allowed time
     */
    timeRestriction?: 'follow' | 'ignore' | 'nearest_available'
    idx?: string // Optional custom value sent with SMS and sent back in CALLBACK

    /**
     * Prevents from sending more than one message with the same idx in last 24h.
     * When this parameter is true and message with the same idx was already sent error 53 is returned.
     */
    checkIdx?: boolean
    normalize?: boolean // Special chars in message will be replaced with their equivalents (ê-e, ñ-n, ý-y, ...)

    /**
     * Send message with the highest priority which ensures the quickest
     * possible time of delivery. Fast messages costs 50% more than normal message.
     * Attention! Mass and marketing messages must not be sent with fast parameter.
     */
    fast?: boolean
    format?: 'json' | 'xml' // Response format
  }

  /**
   * Drivers runtime options
   */
  export interface TwilioRuntimeOptions
    extends Omit<
        TwilioDriverConfig,
        | 'driver'
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

  export interface VonageRuntimeOptions
    extends Pick<VonageDriverConfig, 'webhook'>,
      Omit<SendSmsOptions, 'from' | 'to' | 'text' | 'callback'> {}

  export interface SNSRuntimeOptions extends Omit<PublishInput, 'PhoneNumber' | 'Message'> {
    Attributes?: {
      DefaultSmsType: keyof SNSDefaultSmsType
    } & CapitalizeKeys<
      Pick<
        SNSDriverConfig,
        | 'usageReportS3Bucket'
        | 'deliveryStatusIAMRole'
        | 'deliveryStatusSuccessSamplingRate'
        | 'monthlySpendLimit'
      >
    >
  }

  type CapitalizeKeys<T> = {
    [Key in keyof T as `${Capitalize<string & Key>}`]: T[Key]
  }

  export interface D7RuntimeOptions
    extends Omit<D7DriverConfig, 'driver' | 'apiToken' | 'from' | 'baseUrl'> {}

  export interface TelesignRuntimeOptions
    extends Omit<TelesignDriverConfig, 'driver' | 'type' | 'customerId' | 'apiKey' | 'from'> {
    /**
     * A customer-generated ID for this transaction.
     * The response simply echoes the value provided for this parameter.
     */
    externalId?: string
  }

  export interface InfobipRuntimeOptions
    extends Pick<
      InfobipDriverConfig,
      'webhook' | 'webhookContentType' | 'flash' | 'intermediateReport' | 'sendingSpeedLimit'
    > {
    /**
     * Unique ID assigned to the request if messaging multiple recipients
     * or sending multiple messages via a single API request.
     * If not provided, it will be auto-generated and returned in the API response.
     * Typically, used to fetch delivery reports and message logs.
     */
    bulkId: string
    sendAt: Date

    /**
     * Additional data that can be used for identifying, managing, or monitoring a message.
     * Data included here will also be automatically included in the message Delivery Report.
     * The maximum value is 4000 characters and any overhead may be truncated.
     */
    callbackData: string
  }

  export interface SmsAPIRuntimeOptions extends Omit<SmsAPIDriverConfig, 'driver' | 'accessToken'> {
    /**
     * Date in UNIX timestamp (1287734110) or in ISO 8601 (2012-05-10T08:40:27+00:00)
     * when message will be sent. Setting a past date will result in sending message instantly
     */
    date?: number | Date
    validateDate?: boolean // Checks if date is given in proper format. Returns ERROR:54 if not
  }

  export interface RuntimeOptions {
    vonage: VonageRuntimeOptions
    twilio: TwilioRuntimeOptions
    sns: SNSRuntimeOptions
    d7: D7RuntimeOptions
    telesign: TelesignRuntimeOptions
    infobip: InfobipRuntimeOptions
    smsapi: SmsAPIRuntimeOptions
  }

  /**
   * Drivers response shapes
   */
  export interface D7Response {
    request_id: string
    status: string
    created_at: string
  }

  export interface TelesignResponse {
    reference_id: string
    external_id: string | null
    status: {
      code: number
      description: string
    }
    additional_info?: {
      code_entered: any
      message_parts_count: number
    }
  }

  export interface Responses {
    d7: D7Response
    vonage: MessageRequestResponse
    twilio: any
    sns: any
    telesign: TelesignResponse
    infobip: any
    smsapi: any
  }

  export interface SmsDrivers {
    vonage: {
      implementation: VonageDriverContract
      config: VonageDriverConfig
    }
    twilio: {
      implementation: TwilioDriverContract
      config: TwilioDriverConfig
    }
    d7: {
      implementation: D7DriverContract
      config: D7DriverConfig
    }
    sns: {
      implementation: SNSDriverContract
      config: SNSDriverConfig
    }
    telesign: {
      implementation: TelesignDriverContract
      config: TelesignDriverConfig
    }
    infobip: {
      implementation: InfobipDriverContract
      config: InfobipDriverConfig
    }
    smsapi: {
      implementation: SmsAPIDriverContract
      config: SmsAPIDriverConfig
    }
  }

  export interface SmsManagerContract
    extends ManagerContract<
      ApplicationContract,
      SmsDriverContract,
      SmserContract<keyof SmsersList>,
      { [P in keyof SmsersList]: SmserContract<P> }
    > {
    config: SmsConfig
    send(
      sms: MessageComposeCallback,
      runtimeOptions?: RuntimeOptions[InferSelectedSmserFromConfig['smser']]
    ): Promise<Responses[InferSelectedSmserFromConfig['smser']]>
    sendLater(
      sms: MessageComposeCallback
    ): Promise<Responses[InferSelectedSmserFromConfig['smser']]>
    sendBulk(
      sms: BulkMessageComposeCallback
    ): Promise<Responses[InferSelectedSmserFromConfig['smser']]>
    scheduleSms(sms: CompiledSmsNode): void
  }

  export const BaseSmser: {
    sms: SmsManagerContract
    new <Smser extends keyof SmsersList = keyof SmsersList>(
      ...args: any[]
    ): BaseSmserContract<Smser>
  }

  const Sms: SmsManagerContract

  export default Sms
}
