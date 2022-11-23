import type { ApplicationContract } from '@ioc:Adonis/Core/Application'

import { join } from 'path'
import * as sinkStatic from '@adonisjs/sink'

/**
 * Prompt choices for the sms driver selection
 */
const DRIVER_PROMPTS = [
  {
    name: 'twilio' as const,
    message: 'Twilio',
  },
  {
    name: 'vonage' as const,
    message: 'Vonage',
  },
  {
    name: 'sns' as const,
    message: 'Amazon SNS',
  },
  {
    name: 'd7' as const,
    message: 'D7 Networks',
  },
  {
    name: 'telesign' as const,
    message: 'Telesign',
  },
  {
    name: 'infobip' as const,
    message: 'Infobip',
  },
  {
    name: 'smsapi' as const,
    message: 'SMSAPI',
  },
]

/**
 * Infobip auth methods
 */
const INFOBIP_AUTH_METHODS = [
  {
    name: 'api',
    message: 'Use API key',
  },
  {
    name: 'basic',
    message: 'Use username and password',
  },
]

/**
 * Environment variables for available drivers
 */
const DRIVER_ENV_VALUES = {
  twilio: {
    TWILIO_ACCOUNT_SID: '<twilio-account-sid>',
    TWILIO_AUTH_TOKEN: '<twilio-auth-token>',
  },
  vonage: {
    VONAGE_API_KEY: '<vonage-api-key>',
    VONAGE_API_SECRET: '<vonage-api-secret>',
  },
  sns: {
    SNS_ACCESS_KEY: '<sns-access-key>',
    SNS_ACCESS_SECRET: '<sns-access-secret>',
    SNS_REGION: 'us-east-1',
  },
  d7: {
    D7_API_TOKEN: '<d7-api-token>',
  },
  telesign: {
    TELESIGN_CUSTOMER_ID: '<telesign-customer-id>',
    TELESIGN_API_KEY: '<telesign-api-key>',
  },
  infobip: {
    INFOBIP_BASE_URL: '<infobip-base-url>',
  },
  smsapi: {},
}

const INFOBIP_AUTH_METHODS_ENV_VALUES = {
  api: {
    INFOBIP_API_KEY: '<infobip-api-key>',
  },
  basic: {
    INFOBIP_USERNAME: '<infobip-username>',
    INFOBIP_PASSWORD: '<infobip-password>',
  },
}

/**
 * Prompts user to select one or more sms drivers they are planning
 * to use.
 */
function getSmsDrivers(sink: typeof sinkStatic) {
  return sink
    .getPrompt()
    .multiple('Select the sms drivers you are planning to use', DRIVER_PROMPTS, {
      validate(choices) {
        return choices && choices.length
          ? true
          : 'Select at least one sms driver. You can always change it later'
      },
    })
}

/**
 * Returns the environment variables for the select drivers
 */
function getEnvValues(drivers: (keyof typeof DRIVER_ENV_VALUES)[]) {
  return drivers.reduce((values, driver) => {
    Object.assign(values, DRIVER_ENV_VALUES[driver])
    return values
  }, {})
}

/**
 * Returns absolute path to the stub relative from the templates
 * directory
 */
function getStub(...relativePaths: string[]) {
  return join(__dirname, 'templates', ...relativePaths)
}

export default async function instructions(
  projectRoot: string,
  app: ApplicationContract,
  sink: typeof sinkStatic
) {
  /**
   * Get sms drivers
   */
  const smsDrivers = await getSmsDrivers(sink)
  let infobipAuthMethod: string | null = null

  /**
   * If selected driver is "infobip", prompt auth method.
   */
  if (smsDrivers.includes('infobip')) {
    infobipAuthMethod = await sink
      .getPrompt()
      .choice('Select the auth method for infobip', INFOBIP_AUTH_METHODS, {
        validate(choice) {
          return choice ? true : 'You must select one auth method. You can always change it later'
        },
      })
  }

  /**
   * Create the sms config file
   */
  const configPath = app.configPath('sms.ts')
  const smsConfig = new sink.files.MustacheFile(projectRoot, configPath, getStub('config.txt'))
  smsConfig.overwrite = true

  smsConfig
    .apply({
      primaryDriver: smsDrivers[0],
      twilio: smsDrivers.includes('twilio'),
      vonage: smsDrivers.includes('vonage'),
      sns: smsDrivers.includes('sns'),
      d7: smsDrivers.includes('d7'),
      telesign: smsDrivers.includes('telesign'),
      infobip: smsDrivers.includes('infobip'),
      smsapi: smsDrivers.includes('smsapi'),
    })
    .commit()

  const configDir = app.directoriesMap.get('config') || 'config'
  sink.logger.action('create').succeeded(`${configDir}/sms.ts`)

  /**
   * Create the sms contracts file
   */
  const contractsPath = app.makePath('contracts/sms.ts')
  const smsContract = new sink.files.MustacheFile(
    projectRoot,
    contractsPath,
    getStub('contract.txt')
  )
  smsContract.overwrite = true
  smsContract
    .apply({
      twilio: smsDrivers.includes('twilio'),
      vonage: smsDrivers.includes('vonage'),
      sns: smsDrivers.includes('sns'),
      d7: smsDrivers.includes('d7'),
      telesign: smsDrivers.includes('telesign'),
      infobip: smsDrivers.includes('infobip'),
      smsapi: smsDrivers.includes('smsapi'),
    })
    .commit()
  sink.logger.action('create').succeeded('contracts/sms.ts')

  /**
   * Setup .env file
   */
  const env = new sink.files.EnvFile(projectRoot)

  /**
   * Unset all existing env values as should keep the .env file clean
   */
  Object.keys(
    getEnvValues(['vonage', 'twilio', 'sns', 'd7', 'telesign', 'infobip', 'smsapi'])
  ).forEach((key) => {
    env.unset(key)
  })
  Object.keys(INFOBIP_AUTH_METHODS_ENV_VALUES).forEach((method) => {
    Object.keys(INFOBIP_AUTH_METHODS_ENV_VALUES[method]).forEach((key) => {
      env.unset(key)
    })
  })

  /**
   * Then define the env values for the selected drivers
   */
  const envValues = getEnvValues(smsDrivers)
  Object.keys(envValues).forEach((key) => {
    env.set(key, envValues[key])
  })

  if (infobipAuthMethod) {
    Object.keys(INFOBIP_AUTH_METHODS_ENV_VALUES[infobipAuthMethod]).forEach((key) => {
      env.set(key, INFOBIP_AUTH_METHODS_ENV_VALUES[infobipAuthMethod as string][key])
    })
  }

  env.commit()

  sink.logger.action('update').succeeded('.env,.env.example')

  /**
   * Install required dependencies
   */
  const packagesToInstall: Array<string> = []
  const packagesNamesByDriver = {
    twilio: 'twilio',
    vonage: '@vonage/server-sdk',
    sns: 'aws-sdk',
    infobip: '@infobip-api/sdk',
  }

  for (const driver of Object.keys(packagesNamesByDriver)) {
    if (smsDrivers.includes(driver as any)) {
      packagesToInstall.push(packagesNamesByDriver[driver])
    }
  }

  if (packagesToInstall.length > 0) {
    const pkg = new sink.files.PackageJsonFile(projectRoot)

    packagesToInstall.forEach((packageName) => {
      pkg.install(packageName, undefined, false)
    })

    const spinner = sink.logger.await(
      `Installing packages: ${pkg.getInstalls(false).list.join(', ')}`
    )

    try {
      await pkg.commitAsync()
      spinner.update('Packages installed')
    } catch (error) {
      spinner.update('Unable to install packages')
      sink.logger.fatal(error)
    }

    spinner.stop()
  }

  /**
   * Add new namespace to .adonisrc.json
   */
  const key = 'smsers'
  const adonisrc = new sink.files.AdonisRcFile(projectRoot)

  if (!adonisrc.get(`namespaces.${key}`)) {
    const namespace = 'App/Smsers'

    adonisrc.set(`namespaces.${key}`, namespace)
    adonisrc.commit()
    sink.logger
      .action('update')
      .succeeded(
        `.adonisrc.json ${sink.logger.colors
          .yellow()
          .dim(`{ namespaces += { ${key}: "${namespace}" } }`)}`
      )
  }
}
