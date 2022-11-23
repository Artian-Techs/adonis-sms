import { Expect } from '@japa/expect'
import { ApplicationContract } from '@ioc:Adonis/Core/Application'

declare module '@japa/runner' {
  interface TestContext {
    expect: Expect
    app: ApplicationContract
  }
}
