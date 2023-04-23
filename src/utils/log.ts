export { debug, warning, error, info, notice, startGroup, endGroup, group } from '@actions/core'

export const isDebug = process.env['RUNNER_DEBUG'] === '1'

export const withDebug = (func: () => void): void => {
  if (isDebug) func()
}
