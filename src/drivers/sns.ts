import type { MessageAttributeValue, SNSClient } from '@aws-sdk/client-sns'
import type {
  MessageNode,
  ManyMessagesNode,
  SNSDriverConfig,
  SNSResponse,
  SNSRuntimeOptions,
} from '../types.js'

import { ObjectBuilder } from '@poppinss/utils'
import lodash from '@poppinss/utils/lodash'

import { BaseDriver } from './base_driver.js'
import { SmsResponse } from '../sms_response.js'

/**
 * A sender ID is only valid when it is 1 to 11 alphanumeric characters
 * starting with a letter. Anything else (a phone number, for instance) is
 * rejected by Amazon SNS
 */
const SENDER_ID_PATTERN = /^[A-Za-z][A-Za-z0-9]{0,10}$/

/**
 * Driver for Amazon SNS
 *
 * @see https://docs.aws.amazon.com/sns/latest/api/API_Publish.html
 */
export class SNSDriver extends BaseDriver {
  /**
   * SNS reports deliveries through CloudWatch, not through a webhook
   */
  acceptWebhook = false

  #sns?: SNSClient

  /**
   * The account wide attributes are applied at most once per driver instance
   */
  #accountAttributesApplied = false

  constructor(protected config: SNSDriverConfig) {
    super(config)
  }

  /**
   * Lazily creates the SNS SDK instance. The SDK is an optional peer
   * dependency, hence it is imported on demand
   */
  protected async getSdk() {
    if (this.#sns) {
      return this.#sns
    }

    const { SNSClient: Client } = await import('@aws-sdk/client-sns')

    this.#sns = new Client({
      region: this.config.region,
      credentials: {
        accessKeyId: this.config.key,
        secretAccessKey: this.config.secret,
      },
      ...(this.config.endpoint ? { endpoint: this.config.endpoint } : {}),
    })

    return this.#sns
  }

  /**
   * Send one message to one recipient
   */
  async send(
    { from, to, message }: MessageNode,
    runtimeOptions?: SNSRuntimeOptions
  ): Promise<SmsResponse<SNSResponse>> {
    const sns = await this.getSdk()
    await this.#applyAccountAttributes()

    const { PublishCommand } = await import('@aws-sdk/client-sns')

    const response = await sns.send(
      new PublishCommand({
        Message: message,
        PhoneNumber: to,
        MessageAttributes: this.#messageAttributes(from, runtimeOptions),
        ...lodash.omit(runtimeOptions, [
          'smsType',
          'maxPrice',
          'Message',
          'PhoneNumber',
          'MessageAttributes',
        ]),
      })
    )

    return new SmsResponse(response.MessageId ?? '', response)
  }

  /**
   * Send the exact same message to multiple recipients
   */
  async sendMany(
    { from, to, message }: ManyMessagesNode,
    runtimeOptions?: SNSRuntimeOptions
  ): Promise<SmsResponse<SNSResponse>[]> {
    return this.fanOut(to, (recipient) =>
      this.send({ from, to: recipient, message }, runtimeOptions)
    )
  }

  /**
   * Builds the per message attributes.
   *
   * These are scoped to the message being published, unlike the account wide
   * attributes set through "SetSMSAttributes"
   *
   * @see https://docs.aws.amazon.com/sns/latest/dg/sms_publish-to-phone.html
   */
  #messageAttributes(
    from: string,
    runtimeOptions?: SNSRuntimeOptions
  ): Record<string, MessageAttributeValue> {
    const attributes = new ObjectBuilder<Record<string, MessageAttributeValue>, true>({}, true)

    /**
     * SNS only accepts an alphanumeric sender ID. When the configured sender
     * is a phone number the attribute is left out, and SNS falls back to the
     * originating number of the account
     */
    if (SENDER_ID_PATTERN.test(from)) {
      attributes.add('AWS.SNS.SMS.SenderID', { DataType: 'String', StringValue: from })
    }

    const smsType = runtimeOptions?.smsType ?? this.config.type
    if (smsType) {
      attributes.add('AWS.SNS.SMS.SMSType', { DataType: 'String', StringValue: smsType })
    }

    const maxPrice = runtimeOptions?.maxPrice
    if (maxPrice !== undefined) {
      attributes.add('AWS.SNS.SMS.MaxPrice', {
        DataType: 'Number',
        StringValue: String(maxPrice),
      })
    }

    return {
      ...attributes.toObject(),
      ...runtimeOptions?.MessageAttributes,
    }
  }

  /**
   * Applies the attributes that Amazon SNS only exposes at the account level.
   *
   * They are shared by every application publishing through the same AWS
   * account, so the call is skipped entirely unless one of them is configured
   *
   * @see https://docs.aws.amazon.com/sns/latest/api/API_SetSMSAttributes.html
   */
  async #applyAccountAttributes(): Promise<void> {
    if (this.#accountAttributesApplied) {
      return
    }

    const attributes = new ObjectBuilder<Record<string, string>, true>({}, true)
      .add('MonthlySpendLimit', this.config.monthlySpendLimit?.toString())
      .add('UsageReportS3Bucket', this.config.usageReportS3Bucket)
      .add('DeliveryStatusIAMRole', this.config.deliveryStatusIAMRole)
      .add(
        'DeliveryStatusSuccessSamplingRate',
        this.config.deliveryStatusSuccessSamplingRate?.toString()
      )
      .toObject()

    this.#accountAttributesApplied = true

    if (!Object.keys(attributes).length) {
      return
    }

    const sns = await this.getSdk()
    const { SetSMSAttributesCommand } = await import('@aws-sdk/client-sns')

    await sns.send(new SetSMSAttributesCommand({ attributes }))
  }
}
