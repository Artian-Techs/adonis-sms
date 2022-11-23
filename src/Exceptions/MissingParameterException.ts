import { Exception } from '@poppinss/utils'

export default class MissingParameterException extends Exception {
  public static invoke(parameter: string) {
    return new this(`${parameter} parameter is missing`, 500, 'E_MISSING_PARAMETER')
  }
}
