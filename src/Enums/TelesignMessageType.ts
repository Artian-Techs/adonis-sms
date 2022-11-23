/**
 * Specifies the traffic type being sent in the message.
 * OTP (One-time passwords)
 * ARN (Default) (Alerts, reminders, and notifications)
 * MKT (Marketing traffic)
 */
enum TelesignMessageType {
  OTP = 'OTP',
  ARN = 'ARN',
  MKT = 'MKT',
}

export default TelesignMessageType
