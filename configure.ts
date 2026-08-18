import string from '@poppinss/utils/string'
import type Configure from '@adonisjs/core/commands/configure'

import { stubsRoot } from './stubs/main.js'

/**
 * List of env variables used by the different drivers
 */
const ENV_VARIABLES = {
  twilio: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER'],
  vonage: ['VONAGE_API_KEY', 'VONAGE_API_SECRET'],
  sns: ['SNS_ACCESS_KEY', 'SNS_ACCESS_SECRET', 'SNS_REGION'],
  infobip: ['INFOBIP_BASE_URL', 'INFOBIP_API_KEY'],
}

/**
 * Packages that have to be installed for a given driver
 */
const DRIVER_PACKAGES: Record<string, string> = {
  twilio: 'twilio',
  vonage: '@vonage/server-sdk',
  sns: '@aws-sdk/client-sns',
  infobip: '@infobip-api/sdk',
}

/**
 * List of supported drivers
 */
const KNOWN_DRIVERS = Object.keys(ENV_VARIABLES)

/**
 * Configures the package
 */
export async function configure(command: Configure) {
  /**
   * Read the drivers from the "--drivers" CLI flag
   */
  let selectedDrivers: string | string[] | undefined = command.parsedFlags.drivers

  /**
   * Display prompts when the drivers have not been selected
   * via the CLI flag
   */
  if (!selectedDrivers) {
    selectedDrivers = await command.prompt.multiple(
      'Select the sms services you want to use (none, to write your own driver)',
      KNOWN_DRIVERS
    )
  }

  /**
   * Selecting nothing is a valid answer: the config file is then published
   * with an empty "clients" object, ready for a custom driver
   */
  const clients = typeof selectedDrivers === 'string' ? [selectedDrivers] : (selectedDrivers ?? [])

  const unknownDriver = clients.find((driver) => !KNOWN_DRIVERS.includes(driver))
  if (unknownDriver) {
    command.exitCode = 1
    command.logger.logError(
      `Invalid driver "${unknownDriver}". Supported drivers are: ${string.sentence(KNOWN_DRIVERS)}`
    )

    return
  }

  const codemods = await command.createCodemods()

  /**
   * Publish the config file
   */
  await codemods.makeUsingStub(stubsRoot, 'config/sms.stub', { clients })

  /**
   * Register the provider and the commands
   */
  await codemods.updateRcFile((rcFile) => {
    rcFile.addProvider('@artian-techs/adonis-sms/sms_provider')
    rcFile.addCommand('@artian-techs/adonis-sms/commands')
  })

  /**
   * Define the env variables for the selected drivers
   */
  const envVariables = clients.reduce<Record<string, string>>((result, driver) => {
    ENV_VARIABLES[driver as keyof typeof ENV_VARIABLES].forEach((envVariable) => {
      result[envVariable] = ''
    })

    return result
  }, {})

  await codemods.defineEnvVariables(envVariables)

  /**
   * Define the env variables validation for the selected drivers
   */
  await codemods.defineEnvValidations({
    leadingComment: 'Variables for configuring the sms package',
    variables: Object.keys(envVariables).reduce<Record<string, string>>((result, envVariable) => {
      result[envVariable] = 'Env.schema.string()'

      return result
    }, {}),
  })

  /**
   * Install the SDKs required by the selected drivers
   */
  const packagesToInstall = clients
    .filter((driver) => DRIVER_PACKAGES[driver])
    .map((driver) => ({ name: DRIVER_PACKAGES[driver], isDevDependency: false }))

  if (packagesToInstall.length) {
    await codemods.installPackages(packagesToInstall)
  }
}
