declare module '@ioc:Adonis/Core/Application' {
  import { SmsManagerContract } from '@ioc:Adonis/Addons/Sms'

  export interface ContainerBindings {
    'Adonis/Addons/Sms': SmsManagerContract
  }
}
