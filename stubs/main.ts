import { getDirname } from '@poppinss/utils'

/**
 * Path to the root directory where the stubs are stored. We use this path
 * within commands and the configure hook
 */
export const stubsRoot = getDirname(import.meta.url)
