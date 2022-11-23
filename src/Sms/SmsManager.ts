import type { ApplicationContract } from '@ioc:Adonis/Core/Application'
import type {
  TelesignDriverConfig,
  InfobipDriverConfig,
  VonageDriverConfig,
  TwilioDriverConfig,
  SNSDriverConfig,
  D7DriverConfig,
  SmserContract,
  SmsersList,
  SmsDriverContract,
  MessageComposeCallback,
  CompiledSmsNode,
  BulkMessageComposeCallback,
  RuntimeOptions,
  QueueMonitorCallback,
  SmsAPIDriverConfig,
} from '@ioc:Adonis/Addons/Sms'
import type { SmsConfig } from '../../config'

import fastq from 'fastq'
import { Manager } from '@poppinss/manager'
import { Exception, ManagerConfigValidator } from '@poppinss/utils'

import Smser from './Smser'
import BaseSmser from '../BaseSmser'
import TelesignDriver from '../Drivers/Telesign'
import InfobipDriver from '../Drivers/Infobip'
import VonageDriver from '../Drivers/Vonage'
import TwilioDriver from '../Drivers/Twilio'
import SNSDriver from '../Drivers/SNS'
import D7Driver from '../Drivers/D7'
import SmsAPIDriver from '../Drivers/SmsAPI'

export default class SmsManager extends Manager<
  ApplicationContract,
  SmsDriverContract,
  SmserContract<keyof SmsersList>,
  { [P in keyof SmsersList]: SmserContract<P> }
> {
  /**
   * Cache all drivers instances.
   */
  protected singleton = true

  /**
   * Sms queue to scheduling sms to be delivered later.
   */
  #smsQueue = fastq(this, this.#sendQueuedSms, 10)

  /**
   * Find if package is ready to be used
   */
  #isReady: boolean = false

  /**
   * Method to monitor in-memory sms queue
   */
  #queueMonitor: QueueMonitorCallback = (error) => {
    if (error) {
      this.logger.error(
        {
          from: error.sms.message.from,
          message: error.message,
          to: error.sms.message.to,
        },
        'Unable to deliver sms'
      )
    }
  }

  public BaseSmser = BaseSmser

  public emitter = this.app.container.use('Adonis/Core/Event')
  public logger = this.app.container.use('Adonis/Core/Logger')

  constructor(
    private app: ApplicationContract,
    public config: SmsConfig & { smser: keyof SmsersList }
  ) {
    super(app)
    this.BaseSmser.sms = this
    this.#validateConfig()
  }

  /**
   * Method to schedule sms for sending. This method is invoked by
   * the smser when `sendLater` method is called
   */
  public scheduleSms(sms: CompiledSmsNode) {
    this.#smsQueue.push(sms, this.#queueMonitor as any)
  }

  public use(driver?: keyof SmsersList) {
    if (!this.#isReady) {
      throw new Exception(
        'Missing configuration for sms. Visit https://github.com/Melchyore/adonis-sms for setup instructions',
        500,
        'E_MISSING_SMS_CONFIG'
      )
    }

    return super.use(driver ?? this.getDefaultMappingName())
  }

  public async sendLater(callback: MessageComposeCallback): Promise<any> {
    return await this.use().sendLater(callback)
  }

  public async send(
    callback: MessageComposeCallback,
    runtimeOptions?: RuntimeOptions[keyof SmsersList]
  ) {
    return await this.use().send(callback, runtimeOptions as any)
  }

  public async sendBulk(callback: BulkMessageComposeCallback) {
    return await this.use().sendBulk(callback)
  }

  public createVonage(_: string, config: VonageDriverConfig) {
    return new VonageDriver(config, this.config.debug)
  }

  public createTwilio(_: string, config: TwilioDriverConfig) {
    return new TwilioDriver(config, this.config.debug)
  }

  public createD7(_: string, config: D7DriverConfig) {
    return new D7Driver(config, this.config.debug)
  }

  public createTelesign(_: string, config: TelesignDriverConfig) {
    return new TelesignDriver(config, this.config.debug)
  }

  public createInfobip(_: string, config: InfobipDriverConfig) {
    return new InfobipDriver(config, this.config.debug)
  }

  public createSns(_: string, config: SNSDriverConfig) {
    return new SNSDriver(config, this.config.debug)
  }

  public createSmsapi(_: string, config: SmsAPIDriverConfig) {
    return new SmsAPIDriver(config, this.config.debug)
  }

  protected getDefaultMappingName() {
    if (!this.config.smser) {
      throw new Exception(
        'Invalid "sms" config. Missing value for "smser". Make sure to set it inside the "config/sms" file'
      )
    }

    return this.config.smser
  }

  protected getMappingConfig(mappingName: string /*keyof SmsersList*/) {
    return this.config.smsers[mappingName]
  }

  /**
   * Since we don't expose the drivers instances directly, we wrap them
   * inside the smser instance.
   */
  protected wrapDriverResponse<Name extends keyof SmsersList>(
    mappingName: Name,
    driver: SmsDriverContract
  ): SmserContract<Name> {
    return new Smser(this, true, mappingName, driver)
  }

  protected getMappingDriver(mappingName: keyof SmsersList): string | undefined {
    return this.getMappingConfig(mappingName)?.driver
  }

  /**
   * Sends the sms by pulling it from the queue. This method is invoked
   * automatically by fastq.
   */
  async #sendQueuedSms(sms: CompiledSmsNode, cb: (error: null | any, response?: any) => void) {
    try {
      const response = await this.use(sms.smser).sendCompiled(sms)
      cb(null, { sms, response })
    } catch (error) {
      error.sms = sms
      cb(error)
    }
  }

  /*private createSmser(driver: SmsDriverContract) {
    return new Smser(driver, this.config.from)
  }*/

  #validateConfig() {
    const validator = new ManagerConfigValidator(this.config, 'sms', 'config/sms')
    validator.validateDefault('smser')
    validator.validateList('smsers', 'smser')

    this.#isReady = true
  }
}
