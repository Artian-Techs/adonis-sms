import { BaseCommand, args } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import string from '@poppinss/utils/string'

import { stubsRoot } from '../stubs/main.js'

export default class MakeSms extends BaseCommand {
  static commandName = 'make:sms'
  static description = 'Make a new sms class'
  static options: CommandOptions = {
    allowUnknownFlags: true,
  }

  /**
   * The name of the client file
   */
  @args.string({ description: 'Name of the sms class' })
  declare name: string

  /**
   * Execute the command
   */
  async run(): Promise<void> {
    const entity = this.app.generators.createEntity(this.name)
    const codemods = await this.createCodemods()

    await codemods.makeUsingStub(stubsRoot, 'make/sms/main.stub', {
      flags: this.parsed.flags,
      entity,
      smsName: string.pascalCase(entity.name),
      smsFileName: `${string.snakeCase(entity.name)}.ts`,
    })
  }
}
