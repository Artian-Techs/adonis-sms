import { test } from '@japa/runner'
import { setup, fs } from '../bin/test/config'

import BulkMessage from '../src/Message/BulkMessage'

test.group('Bulk Message', (group) => {
  group.teardown(async () => {
    await fs.cleanup()
  })

  test('add from sender', async ({ expect }) => {
    const bulkMessage = new BulkMessage()
    bulkMessage.from('Test')

    expect(bulkMessage.toJSON().from).toStrictEqual('Test')
  })

  test('add one recipient', async ({ expect }) => {
    const bulkMessage = new BulkMessage()
    bulkMessage.to(['+1212121212', 'Test message'])

    expect(bulkMessage.toJSON().to).toStrictEqual([['+1212121212', 'Test message']])
  })

  test('add many recipients without chaining', async ({ expect }) => {
    const bulkMessage = new BulkMessage()
    bulkMessage.to(['+1212121212', 'Test message 1'], ['+1111111111', 'Test message 2'])

    expect(bulkMessage.toJSON().to).toStrictEqual([
      ['+1212121212', 'Test message 1'],
      ['+1111111111', 'Test message 2'],
    ])
  })

  test('add many recipients with chaining', async ({ expect }) => {
    const bulkMessage = new BulkMessage()
    bulkMessage.to(['+1212121212', 'Test message 1']).to(['+1111111111', 'Test message 2'])

    expect(bulkMessage.toJSON().to).toStrictEqual([
      ['+1212121212', 'Test message 1'],
      ['+1111111111', 'Test message 2'],
    ])
  })

  test('add many recipients using toAll', async ({ expect }) => {
    const bulkMessage = new BulkMessage()
    bulkMessage.toAll([
      ['+1212121212', 'Test message 1'],
      ['+1111111111', 'Test message 2'],
    ])

    expect(bulkMessage.toJSON().to).toStrictEqual([
      ['+1212121212', 'Test message 1'],
      ['+1111111111', 'Test message 2'],
    ])
  })
})
