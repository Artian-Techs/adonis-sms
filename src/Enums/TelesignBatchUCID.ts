/**
 * ATCK - for use in a 2FA situation like updating an account or logging in
 * BACF - for creating an account where the service may be vulnerable to bulk attacks and fraudsters
 * BACS - for creating an account where the service may be vulnerable to bulk attacks or individual spammers
 * CHBK - for use when someone is trying to buy something expensive or unusual and you want to verify it is really them
 * CLDR - calendar event
 * LEAD - for use in a situation where you require a person to enter personal information in order to obtain information about something like a loan or realty or school, and you want to check if the person is bogus or not
 * OTHR - (default) if you have a situation not addressed by other tags
 * PWRT - for use in a situation where a password reset is required
 * RESV - for use when you have end users making reservations and not showing up, and you want to be able to include phone verification in the loop
 * RXPF - for use when you are trying to prevent prescription fraud
 * SHIP - for use when you are sending a shipping notification
 * THEF - for use when you are trying to prevent an end user from deactivating or redirecting a phone number in order to take over someone else's identity
 * TRVF - for use when you are transferring money and you want to check to see if it is approved by sending a text message or phone call to your end user. This is similar to CHBK, but is specifically for a money transaction
 * UNKN - if you have a situation not addressed by other tags (same as OTHR)
 */
enum TelesignBatchUCID {
  ATCK = 'ATCK',
  BACF = 'BACF',
  BACS = 'BACS',
  CHBK = 'CHBK',
  CLDR = 'CLDR',
  LEAD = 'LEAD',
  OTHR = 'OTHR',
  PWRT = 'PWRT',
  RESV = 'RESV',
  RXPF = 'RXPF',
  SHIP = 'SHIP',
  THEF = 'THEF',
  TRVF = 'TRVF',
  UNKN = 'UNKN',
}

export default TelesignBatchUCID
