import { test } from '@japa/runner'

import { Message } from '../../src/message/message.js'
import { BulkMessage } from '../../src/message/bulk_message.js'
import { ManyMessages } from '../../src/message/many_messages.js'

test.group('Message', () => {
  test('define the sender', ({ assert }) => {
    const message = new Message()
    message.from('Test').to('+12121212121').message('Hello world')

    assert.equal(message.toJSON().from, 'Test')
  })

  test('define the recipient', ({ assert }) => {
    const message = new Message()
    message.to('+12121212121').message('Hello world')

    assert.equal(message.toJSON().to, '+12121212121')
  })

  test('define the message body', ({ assert }) => {
    const message = new Message()
    message.to('+12121212121').message('Hello world')

    assert.equal(message.toJSON().message, 'Hello world')
  })

  test('fail when the phone number is not in the E.164 format', ({ assert }) => {
    const message = new Message()

    assert.throws(() => message.to('12121212121'), /is invalid \(12121212121\)/)
  })

  test('fail when the recipient is missing', ({ assert }) => {
    const message = new Message()

    assert.throws(() => message.to(''), '"to" parameter is missing')
  })

  test('fail when the message body is empty', ({ assert }) => {
    const message = new Message()
    message.to('+12121212121').message('   ')

    assert.throws(() => message.toJSON(), 'Message cannot be empty or undefined')
  })

  test('condense whitespaces when trim is enabled', ({ assert }) => {
    const message = new Message({ trim: true })
    message.to('+12121212121').message('Hello    world  !')

    assert.equal(message.toJSON().message, 'Hello world !')
  })

  test('remove accents when normalize is enabled', ({ assert }) => {
    const message = new Message({ normalize: true })
    message.to('+12121212121').message('Béné vôus')

    assert.equal(message.toJSON().message, 'Bene vous')
  })
})

test.group('Many messages', () => {
  test('add one recipient', ({ assert }) => {
    const message = new ManyMessages()
    message.to('+12121212121').message('Hello world')

    assert.deepEqual(message.toJSON().to, ['+12121212121'])
  })

  test('add many recipients in one call', ({ assert }) => {
    const message = new ManyMessages()
    message.to(['+12121212121', '+11111111111']).message('Hello world')

    assert.deepEqual(message.toJSON().to, ['+12121212121', '+11111111111'])
  })

  test('add many recipients by chaining "to"', ({ assert }) => {
    const message = new ManyMessages()
    message.to('+12121212121').to('+11111111111').message('Hello world')

    assert.deepEqual(message.toJSON().to, ['+12121212121', '+11111111111'])
  })

  test('remove duplicate recipients', ({ assert }) => {
    const message = new ManyMessages()
    message.to('+12121212121').to('+12121212121').message('Hello world')

    assert.deepEqual(message.toJSON().to, ['+12121212121'])
  })

  test('fail when one of the phone numbers is invalid', ({ assert }) => {
    const message = new ManyMessages()

    assert.throws(() => message.to(['+12121212121', 'foo']), /is invalid \(foo\)/)
  })
})

test.group('Bulk message', () => {
  test('define the sender', ({ assert }) => {
    const message = new BulkMessage()
    message.from('Test')

    assert.equal(message.toJSON().from, 'Test')
  })

  test('add one pair', ({ assert }) => {
    const message = new BulkMessage()
    message.to([['+12121212121', 'Test message']])

    assert.deepEqual(message.toJSON().to, [['+12121212121', 'Test message']])
  })

  test('add many pairs in one call', ({ assert }) => {
    const message = new BulkMessage()
    message.to([
      ['+12121212121', 'Test message 1'],
      ['+11111111111', 'Test message 2'],
    ])

    assert.deepEqual(message.toJSON().to, [
      ['+12121212121', 'Test message 1'],
      ['+11111111111', 'Test message 2'],
    ])
  })

  test('add many pairs by chaining "to"', ({ assert }) => {
    const message = new BulkMessage()
    message.to([['+12121212121', 'Test message 1']]).to([['+11111111111', 'Test message 2']])

    assert.deepEqual(message.toJSON().to, [
      ['+12121212121', 'Test message 1'],
      ['+11111111111', 'Test message 2'],
    ])
  })
})
