import type { MessageNode, SNSDriverConfig, SNSRuntimeOptions } from '@ioc:Adonis/Addons/Sms'

import AWS from 'aws-sdk'
import { ObjectBuilder } from '@poppinss/utils/build/helpers'
import { lodash } from '@poppinss/utils'

import BaseDriver from './BaseDriver'

export default class SNSDriver extends BaseDriver {
  #sns: AWS.SNS

  constructor(private config: SNSDriverConfig, public debug = false) {
    super(config)

    AWS.config.update({
      region: this.config.region,
      accessKeyId: this.config.key,
      secretAccessKey: this.config.secret,
      sslEnabled: this.config.sslEnabled,
    })

    this.#sns = new AWS.SNS({ apiVersion: this.config.apiVersion })
  }

  public async send(message: MessageNode, runtimeOptions?: SNSRuntimeOptions): Promise<any> {
    const attributes = new ObjectBuilder(true)
      .add('DefaultSenderID', message.from)
      .add('DefaultSmsType', runtimeOptions?.Attributes?.DefaultSmsType ?? this.config.type)
      .add(
        'MonthlySpendLimit',
        runtimeOptions?.Attributes?.MonthlySpendLimit ?? this.config.monthlySpendLimit
      )

    /**
     * https://docs.aws.amazon.com/sns/latest/api/API_SetSMSAttributes.html
     */
    await this.#sns
      .setSMSAttributes({
        attributes: {
          ...attributes.value,
          ...lodash.omit(runtimeOptions?.Attributes, [
            'DefaultSmsType',
            'DefaultSenderID',
            'MonthlySpendLimit',
          ]),
        },
      })
      .promise()

    return Promise.all(
      message.to.map((recipient) => {
        return this.#sns
          .publish({
            Message: message.message,
            PhoneNumber: recipient,
            ...lodash.omit(runtimeOptions, ['Attributes', 'Message', 'PhoneNumber']),
          })
          .promise()
      })
    )
  }
}
