# @artian-techs/adonis-sms

> Send SMS from AdonisJS using some known services

[![github-actions-image]][github-actions-url] [![npm-image]][npm-url] [![license-image]][license-url] [![typescript-image]][typescript-url]

Ships with drivers for **Twilio**, **Vonage** (Messages API), **Amazon SNS** and **Infobip**, and lets you plug in your own.

> **Requires AdonisJS 6 or 7, on Node 24 or above.**
>
> Note that AdonisJS 6 itself supports Node 20, while this package does not.
> Running it on an AdonisJS 6 application therefore means running that
> application on Node 24.

## Table of contents

- [Installation](#installation)
- [Configuration](#configuration)
- [Sending messages](#sending-messages)
  - [Selecting a client](#selecting-a-client)
  - [Runtime options](#runtime-options)
  - [Sending in the background](#sending-in-the-background)
  - [Many recipients, one message](#many-recipients-one-message)
  - [Many recipients, many messages](#many-recipients-many-messages)
- [Class based messages](#class-based-messages)
- [Responses](#responses)
- [Testing](#testing)
- [Sender and webhook resolution](#sender-and-webhook-resolution)
- [Events](#events)
- [Replacing the queue](#replacing-the-queue)
- [Writing a custom driver](#writing-a-custom-driver)
- [Driver reference](#driver-reference)
- [API reference](#api-reference)

## Installation

```sh
node ace add @artian-techs/adonis-sms
```

Or install and configure it manually:

```sh
npm i @artian-techs/adonis-sms
node ace configure @artian-techs/adonis-sms
```

The configure hook asks which services you want to use, then:

- creates `config/sms.ts`
- registers the provider and the commands inside `adonisrc.ts`
- adds the required environment variables to `.env` and `start/env.ts`
- installs the SDK of every selected service

You can skip the prompt with the `--drivers` flag:

```sh
node ace configure @artian-techs/adonis-sms --drivers=twilio --drivers=vonage
```

Each driver's SDK is an **optional peer dependency** loaded on demand, so you only install what you actually use.

## Configuration

Every client is declared through a driver helper. The `SmsClientsList` interface is augmented with the result of `InferSmsClients`, which is what makes `sms.use()` fully typed.

```ts
// config/sms.ts
import env from '#start/env'
import { defineConfig, drivers } from '@artian-techs/adonis-sms'
import type { InferSmsClients } from '@artian-techs/adonis-sms/types'

const smsConfig = defineConfig({
  /**
   * The client used when none is explicitly selected
   */
  default: 'twilio',

  /**
   * Global sender ID, used by every driver that does not define its own
   */
  from: 'AdonisJS',

  /**
   * Replace consecutive whitespaces inside the message body by a single space
   */
  trim: true,

  /**
   * Remove accents from the message body
   */
  normalize: false,

  /**
   * Global webhook URL for delivery reports
   */
  webhook: 'https://example.com/sms/webhook',

  clients: {
    twilio: drivers.twilio({
      accountSid: env.get('TWILIO_ACCOUNT_SID'),
      authToken: env.get('TWILIO_AUTH_TOKEN'),
      from: env.get('TWILIO_PHONE_NUMBER'),
    }),

    vonage: drivers.vonage({
      apiKey: env.get('VONAGE_API_KEY'),
      apiSecret: env.get('VONAGE_API_SECRET'),
    }),
  },
})

export default smsConfig

declare module '@artian-techs/adonis-sms/types' {
  export interface SmsClientsList extends InferSmsClients<typeof smsConfig> {}
}
```

### Global options

| Option      | Type      | Description                                                            |
| ----------- | --------- | ---------------------------------------------------------------------- |
| `default`   | `string`  | Name of the client used when `use()` is called without an argument      |
| `clients`    | `object`  | The clients available to your application                               |
| `from`      | `string`  | Fallback sender for every client                                        |
| `webhook`   | `string`  | Fallback delivery report URL for every client that supports one         |
| `concurrency` | `number` | How many requests a fan-out performs at once. Defaults to 10          |
| `trim`      | `boolean` | Condense consecutive whitespaces in the message body                   |
| `normalize` | `boolean` | Strip accents from the message body                                    |

The same driver can back several clients with a different config — for example a `transactional` and a `promotional` client both using Twilio:

```ts
clients: {
  transactional: drivers.twilio({ /* ... */ from: env.get('TWILIO_TRANSACTIONAL_NUMBER') }),
  promotional: drivers.twilio({ /* ... */ from: env.get('TWILIO_PROMOTIONAL_NUMBER') }),
}
```

## Sending messages

Import the sms service and compose the message through the callback. Recipients must use the [E.164](https://en.wikipedia.org/wiki/E.164) format — anything else throws `E_INVALID_PHONE_NUMBER`.

```ts
import sms from '@artian-techs/adonis-sms/services/main'

await sms.send((message) => {
  message.to('+12121212121').message('Hello world')
})
```

The message builder exposes three chainable methods:

```ts
message.from('AdonisJS').to('+12121212121').message('Hello world')
```

### Selecting a client

```ts
await sms.use('vonage').send((message) => {
  message.to('+12121212121').message('Hello world')
})
```

SmsClient instances are cached for the lifetime of the process, so repeated `use()` calls return the same object. Passing a name that is not in your config throws at runtime, and does not compile in the first place.

### Runtime options

The second argument is forwarded to the driver and is typed against the **selected** client, so Twilio options are not accepted by the Vonage client and vice versa.

```ts
await sms.use('twilio').send(
  (message) => {
    message.to('+12121212121').message('Hello world')
  },
  { statusCallback: 'https://example.com/sms/webhook', validityPeriod: 3600 }
)
```

### Sending in the background

`sendLater` pushes the message to an in-memory queue and resolves immediately, without waiting for the provider.

```ts
await sms.sendLater((message) => {
  message.to('+12121212121').message('Hello world')
})
```

Because delivery happens after the call returns, failures are reported through the [`queued:sms:error`](#events) event rather than a rejected promise.

### Many recipients, one message

```ts
await sms.sendMany((message) => {
  message.to(['+12121212121', '+13131313131']).message('Hello world')
})
```

`to` may be called several times and accepts a single number or an array. Duplicate recipients are removed:

```ts
message.to('+12121212121').to(['+13131313131', '+14141414141'])
```

Infobip accepts multiple destinations in one API call and uses it. The others — Twilio, Vonage and Amazon SNS — fan out into concurrent `send` calls, **at most `concurrency` at a time** (10 by default). An unbounded fan-out over a large audience exhausts sockets and trips provider rate limits, so the bound is deliberate. Raise or lower it globally, or per driver:

```ts
vonage: drivers.vonage({ apiKey: env.get('VONAGE_API_KEY'), concurrency: 25 })
```

### Many recipients, many messages

```ts
await sms.sendBulk((message) => {
  message.to([
    ['+12121212121', 'Hello Jane'],
    ['+13131313131', 'Hello John'],
  ])
})
```

No built-in driver currently exposes a native bulk endpoint, so this fans out into one `send` call per pair. A [custom driver](#writing-a-custom-driver) may implement `sendBulk` to use its provider's own batch endpoint.

## Class based messages

Create a reusable, self contained message:

```sh
node ace make:sms notify_user
```

```ts
// app/sms/notify_user.ts
import { BaseSms } from '@artian-techs/adonis-sms'

export default class NotifyUser extends BaseSms {
  from = 'AdonisJS'

  constructor(private user: User) {
    super()
  }

  /**
   * Called automatically when the message is sent or queued. It may be async
   */
  prepare() {
    this.message.to(this.user.phoneNumber).message('Your order has been shipped')
  }
}
```

```ts
import sms from '@artian-techs/adonis-sms/services/main'
import NotifyUser from '#clients/notify_user'

await new NotifyUser(user).send(sms.use())
await new NotifyUser(user).sendLater(sms.use())
```

`prepare` runs only once per instance, so sending the same object twice does not rebuild the message.

## Testing

`sms.fake()` swaps every client for one that records messages instead of
delivering them, so your test suite never contacts a provider.

```ts
import { test } from '@japa/runner'
import sms from '@artian-techs/adonis-sms/services/main'

test('sends a welcome sms on signup', async ({ client }) => {
  const fake = sms.fake()

  await client.post('/register').json({ phone: '+12121212121' })

  fake.assertSent((message) => message.message.to === '+12121212121')

  sms.restore()
})
```

Always call `sms.restore()` afterwards — a group `teardown` hook is the usual
place — otherwise the fake leaks into the next test.

| Assertion | Passes when |
| --- | --- |
| `assertSent(finder?)` | at least one message matches |
| `assertNotSent(finder?)` | no message matches |
| `assertSentCount(n, finder?)` | exactly `n` messages match |
| `assertNoneSent()` | nothing was sent at all |
| `assertQueued(finder?)` | at least one message went through `sendLater` |

The predicate receives `{ message, config, queued }`, where `message` is the
compiled `{ from, to, message }` node. To inspect rather than assert, use
`fake.sentMessages`, `fake.find(finder)` and `fake.filter(finder)`, and
`fake.clear()` to forget what was recorded.

## Sender and webhook resolution

The sender is resolved in this order, first match wins:

1. the `from` set on the message
2. the `from` set on the driver config
3. the global `from` in `config/sms.ts`

If none is defined, `E_NO_SENDER_PROVIDED` is thrown. The webhook URL follows the same order — runtime options, then driver config, then global config — and is validated before use (`E_INVALID_WEBHOOK_FORMAT`, `E_INVALID_WEBHOOK_PROTOCOL`). It is only forwarded to drivers that report deliveries over HTTP, which is every built-in driver except Amazon SNS.

Each driver maps the resolved URL onto its own parameter name, so you never have to remember whether the provider calls it `callback`, `statusCallback`, `notifyUrl`, `report_url` or `notify_url`.

## Responses

Every driver returns the same `SmsResponse` object, whatever the provider:

```ts
const response = await sms.send((message) => {
  message.to('+12121212121').message('Hello world')
})

response.messageId // string — normalized across every provider
response.original // the raw payload the provider returned for this message
```

Only the identifier is normalized. Providers disagree on everything else — and
in particular, at send time almost all of them merely acknowledge the message,
the real delivery status arriving later on your webhook — so no unified
`status` is exposed. Anything provider specific stays reachable through
`original`, which is fully typed:

```ts
const response = await sms.use('twilio').send(/* ... */)
response.original.numSegments // ✅ typed as a Twilio MessageInstance

const infobip = await sms.use('infobip').send(/* ... */)
infobip.original.status // ✅ typed as an Infobip message entry
```

`messageId` maps to `sid` on Twilio, `MessageId` on Amazon SNS, `messageUUID` on
the Vonage Messages API, and `messageId` on the legacy Vonage API and Infobip.

### Batch responses

`sendMany` and `sendBulk` return `SmsResponse[]`. **The array length is not the
recipient count and the array must never be indexed by recipient** — its length
reflects what the provider actually reported:

| Providers | Entries |
| --- | --- |
| Twilio, Vonage (both drivers), Amazon SNS | one per recipient — the driver sends one request each |
| Infobip | one per entry in the provider's own list |

A driver must never pad that array to match the recipient count: inventing a
per-recipient confirmation the provider never gave would be worse than a short
array. A provider acknowledging a whole batch with a single identifier should
yield a single entry.

## Events

| Event              | Payload                            | Emitted                                       |
| ------------------ | ---------------------------------- | --------------------------------------------- |
| `sms:sending`      | `{ clientName, message }`           | Before handing the message to the driver      |
| `sms:sent`         | `{ clientName, message, response }` | After the driver resolved                     |
| `queued:sms:error` | `{ clientName, error }`             | A background message could not be delivered   |

```ts
import emitter from '@adonisjs/core/services/emitter'
import logger from '@adonisjs/core/services/logger'

emitter.on('queued:sms:error', ({ clientName, error }) => {
  logger.error({ clientName, err: error }, 'Unable to deliver the sms')
})
```

## Replacing the queue

`sendLater` uses an in-memory queue that keeps messages in the process and delivers them in chunks of 10. It is deliberately simple: pending messages are lost if the process restarts. To hand them to a real queue instead, register your own messenger.

```ts
// start/sms.ts
import sms from '@artian-techs/adonis-sms/services/main'
import queue from '@rlanz/bull-queue/services/main'

sms.setMessenger(() => ({
  async queue(compiledSms) {
    await queue.dispatch(SendSmsJob, compiledSms)
  },
}))
```

`compiledSms` is a `CompiledSmsNode` — `{ message, clientName, config }` — which is plain JSON and therefore safe to serialize. In your job, replay it through the client it came from:

```ts
import type { CompiledSmsNode, SmsClientsList } from '@artian-techs/adonis-sms/types'

async function handle(compiledSms: CompiledSmsNode) {
  /**
   * "clientName" is a plain string on the serialized payload, so it has to be
   * narrowed back to a known client name
   */
  await sms.use(compiledSms.clientName as keyof SmsClientsList).sendCompiled(compiledSms)
}
```

The messenger is applied to every client, including the ones already resolved from the cache. A single client can also get its own messenger with `sms.use('twilio').setMessenger(messenger)`.

## Writing a custom driver

A driver is any object satisfying `SmsDriverContract`. In practice you extend `BaseDriver`, which handles the config plumbing and gives you an HTTP helper.

### The contract

```ts
interface SmsDriverContract {
  /**
   * Whether the driver can receive delivery reports on a webhook URL. When
   * false, the resolved webhook is never forwarded to the driver
   */
  acceptWebhook: boolean

  /**
   * Returns the config the driver was created with. Used to resolve the
   * sender and the webhook
   */
  getConfig(): SmsDriverConfig

  /**
   * Send one message to one recipient
   */
  send(message: MessageNode, config?: any): Promise<SmsResponse<any>>

  /**
   * Send the same message to many recipients.
   *
   * The returned array holds one entry per message the provider reported,
   * so it must never be indexed by recipient
   */
  sendMany(message: ManyMessagesNode, config?: any): Promise<SmsResponse<any>[]>

  /**
   * Optional. Send a different message to every recipient in a single call.
   * When absent, "sendBulk" falls back to multiple "send" calls
   */
  sendBulk?(message: BulkMessageNode, config?: any): Promise<SmsResponse<any>[]>
}
```

`send` receives a `MessageNode` whose `from` is already resolved and whose `to` has already been validated, so a driver never has to re-check either.

### A complete example

```ts
// app/sms/drivers/my_provider.ts
import { BaseDriver, SmsResponse } from '@artian-techs/adonis-sms'
import type {
  SmsDriverConfig,
  MessageNode,
  ManyMessagesNode,
} from '@artian-techs/adonis-sms/types'

/**
 * The config your driver accepts inside "config/sms.ts". Extending
 * SmsDriverConfig gives you the shared "from" and "webhook" options
 */
export type MyProviderConfig = SmsDriverConfig & {
  apiKey: string
  baseUrl?: string
}

/**
 * The options accepted as the second argument of "send"
 */
export type MyProviderRuntimeOptions = {
  webhook?: string
  priority?: 'normal' | 'high'
}

/**
 * The shape your provider returns
 */
export type MyProviderResponse = {
  id: string
  status: string
}

export class MyProviderDriver extends BaseDriver {
  constructor(protected config: MyProviderConfig) {
    super(config)
  }

  async send(
    { from, to, message }: MessageNode,
    options?: MyProviderRuntimeOptions
  ): Promise<SmsResponse<MyProviderResponse>> {
    const endpoint = this.config.baseUrl ?? 'https://api.my-provider.com/v1/messages'

    const httpResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        sender: from,
        recipient: to,
        text: message,
        priority: options?.priority ?? 'normal',
        /**
         * The webhook is already resolved from the runtime options, the
         * driver config and the global config, in that order
         */
        callback_url: options?.webhook,
      }),
    })

    const response = (await httpResponse.json()) as MyProviderResponse

    /**
     * Wrap the raw payload so callers get the same shape as every other
     * driver, without losing anything the provider returned
     */
    return new SmsResponse(response.id, response)
  }

  async sendMany(
    { from, to, message }: ManyMessagesNode,
    options?: MyProviderRuntimeOptions
  ): Promise<SmsResponse<MyProviderResponse>[]> {
    return Promise.all(to.map((recipient) => this.send({ from, to: recipient, message }, options)))
  }
}
```

Note the `SmsResponse` wrapper: it is what makes the response shape uniform
across providers. `messageId` is the identifier your provider assigned, and
`original` keeps its raw payload reachable and typed.

The package ships no HTTP helper: use the native `fetch`, your own HTTP client, or the provider's SDK. Nothing in the contract requires any of them — `BaseDriver` only stores the config and exposes it through `getConfig()`.

### Registering it

A driver is registered as a plain factory function. No `extend` call, no service provider.

```ts
// config/sms.ts
import { defineConfig, drivers } from '@artian-techs/adonis-sms'
import { MyProviderDriver } from '../app/sms/drivers/my_provider.js'

const smsConfig = defineConfig({
  default: 'myProvider',
  from: 'AdonisJS',
  clients: {
    myProvider: () => new MyProviderDriver({ apiKey: env.get('MY_PROVIDER_API_KEY') }),

    twilio: drivers.twilio({
      accountSid: env.get('TWILIO_ACCOUNT_SID'),
      authToken: env.get('TWILIO_AUTH_TOKEN'),
      from: env.get('TWILIO_PHONE_NUMBER'),
    }),
  },
})
```

That is all it takes for the driver to become type-safe: `InferSmsClients` picks it up from the config, so `sms.use('myProvider')` returns a client whose runtime options are `MyProviderRuntimeOptions` and whose `send` resolves to `MyProviderResponse`.

```ts
const response = await sms.use('myProvider').send(
  (message) => message.to('+12121212121').message('Hello world'),
  { priority: 'high' } // ✅ typed
)

response.messageId // ✅ string
response.original.status // ✅ typed as MyProviderResponse
```

### Lazy loading an SDK

If your driver depends on a heavy SDK, import it on demand so applications that do not use the driver never pay for it — this is what the built-in drivers do.

```ts
export class MyProviderDriver extends BaseDriver {
  #client?: MyProviderClient

  async #getClient() {
    if (!this.#client) {
      const { MyProviderClient } = await import('my-provider-sdk')
      this.#client = new MyProviderClient(this.config.apiKey)
    }

    return this.#client
  }

  async send(message: MessageNode) {
    const client = await this.#getClient()

    return client.messages.create({ /* ... */ })
  }
}
```

### Notes

- Set `acceptWebhook = false` if your provider has no delivery report URL. The resolved webhook is then never passed to the driver, and no URL validation is performed.
- Implement `sendBulk` only when the provider has a real bulk endpoint. Otherwise leave it out and let the fallback fan out into `send` calls.
- Throw a descriptive error when the provider reports a failure with a `2xx` status. `errors.E_SMS_DRIVER_ERROR` is exported for this purpose.

```ts
import { errors } from '@artian-techs/adonis-sms'

if (response.status !== 'accepted') {
  throw new errors.E_SMS_DRIVER_ERROR([response.reason])
}
```

### Distributing it as a package

Nothing above is specific to an in-app driver. To ship one on npm, export a config helper alongside the driver so consumers get the same ergonomics as the built-in ones:

```ts
import { configProvider } from '@adonisjs/core'
import type { ConfigProvider } from '@adonisjs/core/types'

export function myProvider(
  config: MyProviderConfig
): ConfigProvider<() => MyProviderDriver> {
  return configProvider.create(async () => {
    const { MyProviderDriver } = await import('./driver.js')

    return () => new MyProviderDriver(config)
  })
}
```

```ts
clients: {
  myProvider: myProvider({ apiKey: env.get('MY_PROVIDER_API_KEY') }),
}
```

## Driver reference

All drivers accept the shared `from` and `webhook` options on top of the ones listed below.

### Twilio — `drivers.twilio`

| Option                | Type       | Required |
| --------------------- | ---------- | -------- |
| `accountSid`          | `string`   | yes      |
| `authToken`           | `string`   | yes      |
| `from`                | `string`   | yes      |
| `edge`                | `string`   | no       |
| `region`              | `string`   | no       |
| `lazyLoading`         | `boolean`  | no       |
| `userAgentExtensions` | `string[]` | no       |

Any other option accepted by Twilio's `messages.create` may be passed in the config or at runtime. The webhook is mapped to `statusCallback`.

### Vonage — `drivers.vonage`

Targets the **Messages API**, which supersedes Vonage's legacy SMS API. The
legacy endpoint is not supported: on an account whose dashboard "Default SMS
Setting" is Messages API, it rejects the very same credentials with
`Bad Credentials`.

| Option              | Type                            | Required |
| ------------------- | ------------------------------- | -------- |
| `apiKey`            | `string`                        | no\*     |
| `apiSecret`         | `string`                        | no\*     |
| `applicationId`     | `string`                        | no\*     |
| `privateKey`        | `string \| Buffer`              | no\*     |
| `encodingType`      | `'unicode' \| 'text' \| 'auto'` | no       |
| `contentId`         | `string`                        | no       |
| `entityId`          | `string`                        | no       |
| `appendToUserAgent` | `string`                        | no       |
| `timeout`           | `number`                        | no       |
| `apiHost`           | `string`                        | no       |

\* Authenticate with `applicationId` + `privateKey` (JWT, recommended by
Vonage) or with `apiKey` + `apiSecret` (basic auth).

```ts
clients: {
  vonage: drivers.vonage({
    apiKey: env.get('VONAGE_API_KEY'),
    apiSecret: env.get('VONAGE_API_SECRET'),
  }),
}
```

The webhook is mapped to `webhookUrl` and the response carries a single
`messageUUID`. `contentId` and `entityId` satisfy the regulatory requirements
of some countries. Errors come back as proper HTTP failures and are surfaced as
`E_SMS_DRIVER_ERROR` with the provider's own title and detail.

### Amazon SNS — `drivers.sns`

| Option                              | Type                                 | Required |
| ----------------------------------- | ------------------------------------ | -------- |
| `key`                               | `string`                             | yes      |
| `secret`                            | `string`                             | yes      |
| `region`                            | `string`                             | yes      |
| `type`                              | `'Promotional' \| 'Transactional'`   | yes      |
| `endpoint`                          | `string`                             | no       |
| `monthlySpendLimit`                 | `number`                             | no       |
| `usageReportS3Bucket`               | `string`                             | no       |
| `deliveryStatusIAMRole`             | `string`                             | no       |
| `deliveryStatusSuccessSamplingRate` | `number`                             | no       |

SNS reports deliveries through CloudWatch, so `acceptWebhook` is `false` and the `webhook` option is not available.

**Credentials come from IAM, not from the SNS console.** Create an IAM user, then
an access key for it, and use the pair as `key` and `secret`. New AWS accounts
start in the *SMS sandbox*, where you may only send to phone numbers verified
beforehand in SNS → Text messaging (SMS).

The `type` and the sender are sent as **per message** attributes
(`AWS.SNS.SMS.SMSType`, `AWS.SNS.SMS.SenderID`), so concurrent sends never
interfere with each other. Amazon only accepts a sender ID of 1 to 11
alphanumeric characters starting with a letter — when the resolved sender is a
phone number the attribute is omitted and SNS falls back to the originating
number of the account.

The last four options in the table above have **no per message equivalent**:
Amazon exposes them at the account level only, shared by every application
publishing through the same AWS account. Defining any of them makes the driver
call `SetSMSAttributes` once per driver instance. Leave them unset and this
minimal policy is enough:

```json
{
  "Version": "2012-10-17",
  "Statement": [{ "Effect": "Allow", "Action": "sns:Publish", "Resource": "*" }]
}
```

Add `sns:SetSMSAttributes` to the `Action` list only if you configure the
account level options.

Per message overrides are available at runtime:

```ts
await sms.use('sns').send(
  (message) => message.to('+12121212121').message('Hello world'),
  { smsType: 'Promotional', maxPrice: 0.5 }
)
```

### Infobip — `drivers.infobip`

| Option               | Type                                              | Required |
| -------------------- | ------------------------------------------------- | -------- |
| `baseUrl`            | `string`                                          | yes      |
| `apiKey`             | `string`                                          | no\*     |
| `username`           | `string`                                          | no\*     |
| `password`           | `string`                                          | no\*     |
| `authType`           | `'App' \| 'Basic'`                                | no       |
| `flash`              | `boolean`                                         | no       |
| `intermediateReport` | `boolean`                                         | no       |
| `webhookContentType` | `'application/json' \| 'application/xml'`         | no       |
| `sendingSpeedLimit`  | `{ amount, timeUnit }`                            | no       |

\* Use `apiKey` with `authType: 'App'`, or `username` + `password` with `authType: 'Basic'`. The webhook is mapped to `notifyUrl`.

Infobip answers with one entry per destination, so each becomes its own `SmsResponse`. The `bulkId` of the enclosing response — the handle you need to fetch delivery reports for a batch — is copied onto every entry's `original`.

## API reference

### `sms` (SmsManager)

| Method                              | Description                                              |
| ----------------------------------- | -------------------------------------------------------- |
| `use(name?)`                        | Resolve a client. Falls back to the default one           |
| `send(callback, options?)`          | Send through the default client                           |
| `sendLater(callback, options?)`     | Queue through the default client                          |
| `sendMany(callback, options?)`      | Same message to many recipients                          |
| `sendBulk(callback, options?)`      | Different message per recipient                          |
| `setMessenger(factory)`             | Replace the background queue for every client             |
| `config`                            | The resolved config                                      |

### `sms.use(...)` (SmsClient)

| Method                          | Description                                             |
| ------------------------------- | ------------------------------------------------------- |
| `send(callback, options?)`      | Send a message                                          |
| `sendLater(callback, options?)` | Queue a message                                         |
| `sendMany(callback, options?)`  | Same message to many recipients                         |
| `sendBulk(callback, options?)`  | Different message per recipient                         |
| `sendCompiled(compiledSms)`     | Send an already compiled message                        |
| `setMessenger(messenger)`       | Replace the background queue for this client             |
| `name`                          | The client name                                          |
| `driver`                        | The underlying driver instance                          |

### `SmsResponse`

| Property    | Description                                                          |
| ----------- | -------------------------------------------------------------------- |
| `messageId` | The identifier assigned by the provider, normalized across drivers   |
| `original`  | The raw payload the provider returned for this message               |
| `toJSON()`  | A plain object of the two, handy for logging                         |

### Errors

Exported under the `errors` namespace, all built with `createError`:

| Error | Status | Raised when |
| --- | --- | --- |
| `E_INVALID_PHONE_NUMBER` | 422 | the recipient is not in the E.164 format |
| `E_MISSING_PARAMETER` | 422 | a required field is missing on the message |
| `E_MISSING_MESSAGE` | 422 | the message body is empty |
| `E_INVALID_WEBHOOK_FORMAT` | 422 | the webhook is not a valid URL |
| `E_INVALID_WEBHOOK_PROTOCOL` | 422 | the webhook is not HTTP(S) |
| `E_SMS_DRIVER_ERROR` | 400 | the provider rejected the message |
| `E_NO_SENDER_PROVIDED` | 500 | no sender is configured anywhere |

Mistakes made while composing a message are 422s, so an invalid phone number
surfaces as a validation error rather than an internal one. Only a broken
configuration, which the caller cannot fix at runtime, stays a 500.

### Debugging

Set `NODE_DEBUG=adonisjs:sms` to trace client creation and message delivery.

## License

[MIT](LICENSE.md)

[github-actions-image]: https://img.shields.io/github/actions/workflow/status/Artian-Techs/adonis-sms/test.yml?style=for-the-badge
[github-actions-url]: https://github.com/Artian-Techs/adonis-sms/actions/workflows/test.yml 'github-actions'
[npm-image]: https://img.shields.io/npm/v/@artian-techs/adonis-sms.svg?style=for-the-badge&logo=npm
[npm-url]: https://npmjs.org/package/@artian-techs/adonis-sms 'npm'
[license-image]: https://img.shields.io/npm/l/@artian-techs/adonis-sms?color=blueviolet&style=for-the-badge
[license-url]: LICENSE.md 'license'
[typescript-image]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: https://www.typescriptlang.org 'typescript'
