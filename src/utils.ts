import string from '@poppinss/utils/string'

import * as errors from './errors.js'

/**
 * Ensure the phone number is defined and uses the E.164 format
 */
export function validatePhoneNumber(phoneNumber: string) {
  if (!phoneNumber) {
    throw new errors.E_MISSING_PARAMETER(['to'])
  }

  if (!/^\+[1-9]\d{10,14}$/.test(phoneNumber)) {
    throw new errors.E_INVALID_PHONE_NUMBER([phoneNumber])
  }
}

/**
 * Remove accents from the message
 */
export function normalizeMessage(message: string) {
  return message.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/**
 * Replace consecutive whitespaces by a single space
 */
export function removeExtraSpaces(message: string) {
  return string.condenseWhitespace(message)
}

/**
 * Ensure the message body is not empty
 */
export function checkMessage(message?: string) {
  if (!message || message.trim() === '') {
    throw new errors.E_MISSING_MESSAGE()
  }
}

/**
 * Ensure the webhook is a valid HTTP(S) URL
 */
export function validateWebhook(webhook: string) {
  let url: URL

  try {
    url = new URL(webhook)
  } catch {
    throw new errors.E_INVALID_WEBHOOK_FORMAT([webhook])
  }

  const protocol = url.protocol.replace(':', '')

  if (!['http', 'https'].includes(protocol)) {
    throw new errors.E_INVALID_WEBHOOK_PROTOCOL([protocol])
  }
}

/**
 * The number of requests a fan-out performs at once when the provider has no
 * batch endpoint. Sending to a large audience with an unbounded "Promise.all"
 * exhausts sockets and trips provider rate limits
 */
export const DEFAULT_CONCURRENCY = 10

/**
 * Maps over the items, keeping at most "limit" promises in flight, and
 * resolves to the results in the original order
 */
export async function mapWithConcurrency<Item, Result>(
  items: Item[],
  limit: number,
  mapper: (item: Item, index: number) => Promise<Result>
): Promise<Result[]> {
  const size = Math.max(1, Math.trunc(limit) || DEFAULT_CONCURRENCY)

  if (items.length <= size) {
    return Promise.all(items.map(mapper))
  }

  const results = new Array<Result>(items.length)
  let cursor = 0

  const workers = Array.from({ length: size }, async () => {
    while (cursor < items.length) {
      const index = cursor++
      results[index] = await mapper(items[index], index)
    }
  })

  await Promise.all(workers)

  return results
}
