import type { ReplContract } from '@ioc:Adonis/Addons/Repl'
import type { ApplicationContract } from '@ioc:Adonis/Core/Application'

import { requireAll } from '@poppinss/utils/build/helpers'

/**
 * Helper to define REPL state
 */
function setupReplState(repl: ReplContract, key: string, value: any) {
  repl.server.context[key] = value
  repl.notify(
    `Loaded ${key} module. You can access it using the "${repl.colors.underline(key)}" variable`
  )
}

/**
 * Define repl bindings. The method must be invoked when application environment
 * is set to repl.
 */
export function defineReplBindings(application: ApplicationContract, Repl: ReplContract) {
  Repl.addMethod(
    'loadSms',
    (repl: ReplContract) => {
      setupReplState(repl, 'Sms', application.container.use('Adonis/Addons/Sms'))
    },
    {
      description: 'Load sms provider and save reference to the "Sms" variable',
    }
  )

  Repl.addMethod(
    'loadSmsers',
    (repl: ReplContract) => {
      const smsersPath = application.resolveNamespaceDirectory('smsers') || 'app/Smsers'
      console.log(repl.colors.dim(`recursively reading smsers from "${smsersPath}"`))

      const smserAbsPath = application.makePath(smsersPath)
      setupReplState(repl, 'smsers', requireAll(smserAbsPath))
    },
    {
      description: 'Recursively loads Smsers to the "smsers" property',
    }
  )
}
