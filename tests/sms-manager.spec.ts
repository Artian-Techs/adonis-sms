import type { SmserContract, SmsersList } from '@ioc:Adonis/Addons/Sms'

import { test } from '@japa/runner'
import { setup, fs } from '../bin/test/config'

import SmsManager from '../src/Sms/SmsManager'
import BaseSmser from '../src/BaseSmser'
import Smser from '../src/Sms/Smser'
import TwilioDriver from '../src/Drivers/Twilio'
import VonageDriver from '../src/Drivers/Vonage'
import SNSDriver from '../src/Drivers/SNS'
import D7Driver from '../src/Drivers/D7'
import TelesignDriver from '../src/Drivers/Telesign'
import InfobipDriver from '../src/Drivers/Infobip'
import SmsAPIDriver from '../src/Drivers/SmsAPI'

test.group('Sms Manager', (group) => {
  group.teardown(async () => {
    await fs.cleanup()
  })

  test('return driver for a given mapping', async ({ expect }) => {
    const config = {
      smser: 'twilio',
      smsers: {
        twilio: {
          driver: 'twilio',
        },
      },
    }

    const app = await setup()
    const manager = new SmsManager(app, config as any)

    expect(manager['getMappingDriver']('twilio')).toStrictEqual('twilio')
  })

  test('return default mapping name', async ({ expect }) => {
    const config = {
      smser: 'twilio',
      smsers: {
        twilio: {
          driver: 'twilio',
        },
      },
    }

    const app = await setup()
    const manager = new SmsManager(app, config as any)

    expect(manager['getDefaultMappingName']()).toStrictEqual('twilio')
  })

  test('return config for a mapping name', async ({ expect }) => {
    const config = {
      smser: 'twilio',
      smsers: {
        twilio: {
          driver: 'twilio',
        },
      },
    }

    const app = await setup()
    const manager = new SmsManager(app, config as any)

    expect(manager['getMappingConfig']('twilio')).toStrictEqual({ driver: 'twilio' })
  })

  test('extend smser by adding a custom driver', async ({ expect }) => {
    const config = {
      smser: 'marketing',
      smsers: {
        marketing: {
          driver: 'myDriver',
        },
      },
    }

    const app = await setup()
    const manager = new SmsManager(app, config as any)
    const myDriver = {
      async send() {},
      debug: true,
      getConfig() {
        return {}
      },
    }

    manager.extend('myDriver', () => myDriver)

    expect(manager['getMappingConfig']('marketing')).toStrictEqual({ driver: 'myDriver' })
    expect(manager['makeExtendedDriver']('marketing', 'myDriver').driver).toStrictEqual(myDriver)
  })

  test('BaseSmser should exist on SmsManager', async ({ expect }) => {
    const config = {
      smser: 'twilio',
      smsers: {
        twilio: {
          driver: 'twilio',
        },
      },
    }

    const app = await setup()
    const manager = new SmsManager(app, config as any)

    expect(manager['BaseSmser']).toStrictEqual(BaseSmser)
  })
})

test.group('Sms Manager | Twilio', (group) => {
  group.each.teardown(async () => {
    await fs.cleanup()
  })

  test('get smser instance for twilio driver', async ({ expect }) => {
    const config = {
      smser: 'marketing',
      smsers: {
        marketing: {
          driver: 'twilio',
        },
      },
    }

    const app = await setup()
    const manager = new SmsManager(app, config as any)
    const smser = manager.use() as SmserContract<keyof SmsersList>

    expect(smser).toBeInstanceOf(Smser)
    expect(smser.driver).toBeInstanceOf(TwilioDriver)
  })

  test('cache smser instances for twilio', async ({ expect }) => {
    const config = {
      smser: 'marketing',
      smsers: {
        marketing: {
          driver: 'twilio',
        },
      },
    }

    const app = await setup()
    const manager = new SmsManager(app, config as any)
    const smser = manager.use()
    const smser1 = manager.use()

    expect(smser).toStrictEqual(smser1)
  })
})

test.group('Sms Manager | Vonage', (group) => {
  group.each.teardown(async () => {
    await fs.cleanup()
  })

  test('get smser instance for vonage driver', async ({ expect }) => {
    const config = {
      smser: 'marketing',
      smsers: {
        marketing: {
          driver: 'vonage',
        },
      },
    }

    const app = await setup()
    const manager = new SmsManager(app, config as any)
    const smser = manager.use() as SmserContract<keyof SmsersList>

    expect(smser).toBeInstanceOf(Smser)
    expect(smser.driver).toBeInstanceOf(VonageDriver)
  })

  test('cache smser instances for vonage', async ({ expect }) => {
    const config = {
      smser: 'marketing',
      smsers: {
        marketing: {
          driver: 'vonage',
        },
      },
    }

    const app = await setup()
    const manager = new SmsManager(app, config as any)
    const smser = manager.use()
    const smser1 = manager.use()

    expect(smser).toStrictEqual(smser1)
  })
})

test.group('Sms Manager | SNS', (group) => {
  group.each.teardown(async () => {
    await fs.cleanup()
  })

  test('get smser instance for sns driver', async ({ expect }) => {
    const config = {
      smser: 'marketing',
      smsers: {
        marketing: {
          driver: 'sns',
        },
      },
    }

    const app = await setup()
    const manager = new SmsManager(app, config as any)
    const smser = manager.use() as SmserContract<keyof SmsersList>

    expect(smser).toBeInstanceOf(Smser)
    expect(smser.driver).toBeInstanceOf(SNSDriver)
  })

  test('cache smser instances for sns', async ({ expect }) => {
    const config = {
      smser: 'marketing',
      smsers: {
        marketing: {
          driver: 'sns',
        },
      },
    }

    const app = await setup()
    const manager = new SmsManager(app, config as any)
    const smser = manager.use()
    const smser1 = manager.use()

    expect(smser).toStrictEqual(smser1)
  })
})

test.group('Sms Manager | D7', (group) => {
  group.each.teardown(async () => {
    await fs.cleanup()
  })

  test('get smser instance for d7 driver', async ({ expect }) => {
    const config = {
      smser: 'marketing',
      smsers: {
        marketing: {
          driver: 'd7',
        },
      },
    }

    const app = await setup()
    const manager = new SmsManager(app, config as any)
    const smser = manager.use() as SmserContract<keyof SmsersList>

    expect(smser).toBeInstanceOf(Smser)
    expect(smser.driver).toBeInstanceOf(D7Driver)
  })

  test('cache smser instances for d7', async ({ expect }) => {
    const config = {
      smser: 'marketing',
      smsers: {
        marketing: {
          driver: 'd7',
        },
      },
    }

    const app = await setup()
    const manager = new SmsManager(app, config as any)
    const smser = manager.use()
    const smser1 = manager.use()

    expect(smser).toStrictEqual(smser1)
  })
})

test.group('Sms Manager | Telesign', (group) => {
  group.each.teardown(async () => {
    await fs.cleanup()
  })

  test('get smser instance for telesign driver', async ({ expect }) => {
    const config = {
      smser: 'marketing',
      smsers: {
        marketing: {
          driver: 'telesign',
        },
      },
    }

    const app = await setup()
    const manager = new SmsManager(app, config as any)
    const smser = manager.use() as SmserContract<keyof SmsersList>

    console.log(smser)

    expect(smser).toBeInstanceOf(Smser)
    expect(smser.driver).toBeInstanceOf(TelesignDriver)
  })

  test('cache smser instances for telesign', async ({ expect }) => {
    const config = {
      smser: 'marketing',
      smsers: {
        marketing: {
          driver: 'telesign',
        },
      },
    }

    const app = await setup()
    const manager = new SmsManager(app, config as any)
    const smser = manager.use()
    const smser1 = manager.use()

    expect(smser).toStrictEqual(smser1)
  })
})

test.group('Sms Manager | Infobip', (group) => {
  group.each.teardown(async () => {
    await fs.cleanup()
  })

  test('get smser instance for infobip driver', async ({ expect }) => {
    const config = {
      smser: 'marketing',
      smsers: {
        marketing: {
          driver: 'infobip',
        },
      },
    }

    const app = await setup()
    const manager = new SmsManager(app, config as any)
    const smser = manager.use() as SmserContract<keyof SmsersList>

    expect(smser).toBeInstanceOf(Smser)
    expect(smser.driver).toBeInstanceOf(InfobipDriver)
  })

  test('cache smser instances for infobip', async ({ expect }) => {
    const config = {
      smser: 'marketing',
      smsers: {
        marketing: {
          driver: 'infobip',
        },
      },
    }

    const app = await setup()
    const manager = new SmsManager(app, config as any)
    const smser = manager.use()
    const smser1 = manager.use()

    expect(smser).toStrictEqual(smser1)
  })
})

test.group('Sms Manager | SmsAPI', (group) => {
  group.each.teardown(async () => {
    await fs.cleanup()
  })

  test('get smser instance for smsapi driver', async ({ expect }) => {
    const config = {
      smser: 'marketing',
      smsers: {
        marketing: {
          driver: 'smsapi',
        },
      },
    }

    const app = await setup()
    const manager = new SmsManager(app, config as any)
    const smser = manager.use() as SmserContract<keyof SmsersList>

    expect(smser).toBeInstanceOf(Smser)
    expect(smser.driver).toBeInstanceOf(SmsAPIDriver)
  })

  test('cache smser instances for smsapi', async ({ expect }) => {
    const config = {
      smser: 'marketing',
      smsers: {
        marketing: {
          driver: 'smsapi',
        },
      },
    }

    const app = await setup()
    const manager = new SmsManager(app, config as any)
    const smser = manager.use()
    const smser1 = manager.use()

    expect(smser).toStrictEqual(smser1)
  })
})
