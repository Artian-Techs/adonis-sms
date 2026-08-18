import { test } from '@japa/runner'

import { type SmsClient } from '../../src/sms_client.js'
import { SmsManager } from '../../src/sms_manager.js'
import { defineConfig, drivers } from '../../src/define_config.js'
import { type InfobipDriver } from '../../src/drivers/infobip.js'
import { type TwilioDriver } from '../../src/drivers/twilio.js'
import { type SmsResponse } from '../../src/sms_response.js'
import type {
  InfobipMessageResponse,
  InfobipRuntimeOptions,
  InferSmsClients,
  InfobipDriverConfig,
  SNSDriverConfig,
  TwilioResponse,
  TwilioRuntimeOptions,
  ValuesOf,
} from '../../src/types.js'
import { type ContentType, type InfobipAuthType, type SNSDefaultSmsType } from '../../src/enums.js'
import { createEmitter } from '../helpers.js'

const smsConfig = defineConfig({
  default: 'twilio',
  clients: {
    twilio: drivers.twilio({ accountSid: 'sid', authToken: 'token', from: '+12121212121' }),
    infobip: drivers.infobip({ baseUrl: 'https://foo.com', apiKey: 'key' }),
  },
})

type KnownClients = InferSmsClients<typeof smsConfig>

/**
 * Mirrors the return type of "SmsManager.use"
 */
type SmsClientFor<K extends keyof KnownClients> = SmsClient<ReturnType<KnownClients[K]>>

test.group('Types', () => {
  test('infer the client names from the config', ({ expectTypeOf }) => {
    expectTypeOf<keyof KnownClients>().toEqualTypeOf<'twilio' | 'infobip'>()
  })

  test('derive the enum unions through "ValuesOf"', ({ expectTypeOf }) => {
    expectTypeOf<ValuesOf<typeof ContentType>>().toEqualTypeOf<
      'application/json' | 'application/xml'
    >()
    expectTypeOf<ValuesOf<typeof InfobipAuthType>>().toEqualTypeOf<'Basic' | 'App'>()
    expectTypeOf<ValuesOf<typeof SNSDefaultSmsType>>().toEqualTypeOf<
      'Promotional' | 'Transactional'
    >()
  })

  test('type the enum backed config options', ({ expectTypeOf }) => {
    expectTypeOf<InfobipDriverConfig['authType']>().toEqualTypeOf<'Basic' | 'App' | undefined>()
    expectTypeOf<SNSDriverConfig['type']>().toEqualTypeOf<'Promotional' | 'Transactional'>()
  })

  test('infer the driver from the selected client', ({ expectTypeOf }) => {
    expectTypeOf<ReturnType<KnownClients['twilio']>>().toEqualTypeOf<TwilioDriver>()
    expectTypeOf<ReturnType<KnownClients['infobip']>>().toEqualTypeOf<InfobipDriver>()
    expectTypeOf<SmsClientFor<'twilio'>['driver']>().toEqualTypeOf<TwilioDriver>()
    expectTypeOf<SmsClientFor<'infobip'>['driver']>().toEqualTypeOf<InfobipDriver>()
  })

  test('infer the runtime options from the selected client', ({ expectTypeOf }) => {
    expectTypeOf<Parameters<SmsClientFor<'twilio'>['send']>[1]>().toEqualTypeOf<
      TwilioRuntimeOptions | undefined
    >()

    expectTypeOf<Parameters<SmsClientFor<'infobip'>['send']>[1]>().toEqualTypeOf<
      InfobipRuntimeOptions | undefined
    >()
  })

  test('wrap the provider response in "SmsResponse"', ({ expectTypeOf }) => {
    expectTypeOf<Awaited<ReturnType<SmsClientFor<'infobip'>['send']>>>().toEqualTypeOf<
      SmsResponse<InfobipMessageResponse>
    >()
    expectTypeOf<Awaited<ReturnType<SmsClientFor<'twilio'>['send']>>>().toEqualTypeOf<
      SmsResponse<TwilioResponse>
    >()
  })

  test('return an array of responses for the batch methods', ({ expectTypeOf }) => {
    expectTypeOf<Awaited<ReturnType<SmsClientFor<'infobip'>['sendMany']>>>().toEqualTypeOf<
      SmsResponse<InfobipMessageResponse>[]
    >()
    expectTypeOf<Awaited<ReturnType<SmsClientFor<'infobip'>['sendBulk']>>>().toEqualTypeOf<
      SmsResponse<InfobipMessageResponse>[]
    >()
    expectTypeOf<Awaited<ReturnType<SmsClientFor<'twilio'>['sendMany']>>>().toEqualTypeOf<
      SmsResponse<TwilioResponse>[]
    >()
  })

  test('only accept the configured client names', ({ expectTypeOf }) => {
    const manager = new SmsManager<KnownClients>(createEmitter(), {
      default: 'twilio',
      clients: {} as KnownClients,
    })

    expectTypeOf(manager.use).parameter(0).toEqualTypeOf<'twilio' | 'infobip' | undefined>()
  })
})
