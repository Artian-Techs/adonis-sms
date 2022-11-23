import { join } from 'path'
import { args, BaseCommand } from '@adonisjs/core/build/standalone'

/**
 * Command to make a new smser
 */
export default class MakeSmser extends BaseCommand {
  /**
   * Command meta data
   */
  public static commandName = 'make:smser'
  public static description = 'Make a new smser class'

  @args.string({ description: 'Name of the smser class' })
  public name: string

  /**
   * Create the smser template
   */
  public async run() {
    const stub = join(__dirname, '..', 'templates', 'smser.txt')
    const path = this.application.resolveNamespaceDirectory('smsers')

    this.generator
      .addFile(this.name, { pattern: 'pascalcase' })
      .stub(stub)
      .destinationDir(path || 'app/Smsers')
      .useMustache()
      .appRoot(this.application.cliCwd || this.application.appRoot)

    await this.generator.run()
  }
}
