import { test } from '@japa/runner'
import { setup, fs } from '../bin/test/config'

import Message from '../src/Message/Message'

test.group('Message', (group) => {
  group.teardown(async () => {
    await fs.cleanup()
  })

  test('add from sender', async ({ expect }) => {
    const message = new Message()
    message.from('Test')

    expect(message.toJSON().from).toStrictEqual('Test')
  })

  test('add one recipient', async ({ expect }) => {
    const message = new Message()
    message.to('+1212121212')

    expect(message.toJSON().to).toStrictEqual(['+1212121212'])
  })

  test('add many recipients without chaining', async ({ expect }) => {
    const message = new Message()
    message.to('+1212121212', '+1111111111')

    expect(message.toJSON().to).toStrictEqual(['+1212121212', '+1111111111'])
  })

  test('add many recipients with chaining', async ({ expect }) => {
    const message = new Message()
    message.to('+1212121212').to('+1111111111')

    expect(message.toJSON().to).toStrictEqual(['+1212121212', '+1111111111'])
  })

  test('add many recipients using toAll', async ({ expect }) => {
    const message = new Message()
    message.toAll(['+1212121212', '+1111111111'])

    expect(message.toJSON().to).toStrictEqual(['+1212121212', '+1111111111'])
  })

  test('duplicate numbers should be removed', async ({ expect }) => {
    const message = new Message()
    message.toAll(['+1212121212', '+1212121212'])

    expect(message.toJSON().to).toStrictEqual(['+1212121212'])
  })

  test('add sms text message', async ({ expect }) => {
    const message = new Message()
    message.message('Hello world')

    expect(message.toJSON().message).toStrictEqual('Hello world')
  })
})
