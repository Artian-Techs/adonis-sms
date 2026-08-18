/**
 * A normalized response returned by every driver, regardless of the
 * underlying provider.
 *
 * Providers agree on very little, so only the message identifier is
 * normalized. Everything else stays reachable through the "original"
 * property, which holds the raw payload the provider returned for this
 * message
 */
export class SmsResponse<T> {
  constructor(
    /**
     * The identifier assigned to the message by the provider. Depending on
     * the provider this is its "sid", "MessageId", "request_id",
     * "reference_id" or "messageId"
     */
    public messageId: string,

    /**
     * The raw payload the provider returned for this message. When the
     * provider only answers at the batch level, this is the batch payload
     */
    public original: T
  ) {}

  toJSON() {
    return {
      messageId: this.messageId,
      original: this.original,
    }
  }
}
